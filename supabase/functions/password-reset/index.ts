import { createClient } from "@supabase/supabase-js";

const genericMessage = "หากข้อมูลตรงกับบัญชี ระบบจะส่งลิงก์ตั้งรหัสผ่านไปยังอีเมล";
const encoder = new TextEncoder();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}
function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}
function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256(value: string) {
  return bytesToHex(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  );
}
function escapeHtml(value: unknown) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch] || ch));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
  const secretKey = secretKeys.default ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!secretKey || !supabaseUrl) {
    return json({ error: "ระบบรีเซ็ตรหัสผ่านยังไม่ได้ตั้งค่า" }, 503);
  }
  const admin = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false },
  });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "ข้อมูลคำขอไม่ถูกต้อง" }, 400);
  }

  if (body.action === "confirm") {
    const token = String(body.token || ""),
      password = String(body.password || "");
    if (
      !/^[a-f0-9]{64}$/.test(token) || password.length < 6 ||
      password.length > 128
    ) {
      return json({ error: "ลิงก์ไม่ถูกต้องหรือรหัสผ่านสั้นเกินไป" }, 400);
    }
    const { data, error } = await admin.rpc("app_complete_password_reset", {
      p_token_hash: await sha256(token),
      p_password: password,
    });
    if (error) return json({ error: "ไม่สามารถตั้งรหัสผ่านได้" }, 500);
    if (!data) return json({ error: "ลิงก์หมดอายุหรือถูกใช้งานแล้ว" }, 400);
    return json({ ok: true });
  }

  if (body.action !== "request") return json({ error: "คำขอไม่ถูกต้อง" }, 400);
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const fromEmail = Deno.env.get("RESET_FROM_EMAIL");
  const publicSite = Deno.env.get("PUBLIC_SITE_URL");
  if (!resendKey || !fromEmail || !publicSite) {
    return json({ error: "ระบบส่งอีเมลยังไม่ได้ตั้งค่า" }, 503);
  }

  const role = body.role === "admin" ? "admin" : "school";
  const email = normalizeEmail(body.email),
    code = String(body.code || "").trim().toLowerCase();
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || (role === "school" && !code)
  ) {
    return json({ ok: true, message: genericMessage });
  }

  let account: { id?: string; name?: string; email?: string } | null = null;
  if (role === "admin") {
    const result = await admin.from("app_admins").select("email").eq("id", 1)
      .eq("email", email).maybeSingle();
    if (!result.error && result.data) {
      account = { name: "Admin หลัก", email: result.data.email };
    }
  } else {
    const result = await admin.from("app_schools").select("id,name,email").eq(
      "code",
      code,
    ).eq("email", email).eq("active", true).maybeSingle();
    if (!result.error && result.data) account = result.data;
  }
  if (!account) return json({ ok: true, message: genericMessage });

  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  let recent = admin.from("app_password_resets").select("id").eq("role", role)
    .gte("created_at", oneMinuteAgo).limit(1);
  recent = role === "school"
    ? recent.eq("school_id", account.id!)
    : recent.is("school_id", null);
  if ((await recent.maybeSingle()).data) {
    return json({ ok: true, message: genericMessage });
  }

  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const token = bytesToHex(raw), tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
  let oldTokens = admin.from("app_password_resets").update({
    used_at: new Date().toISOString(),
  })
    .eq("role", role).is("used_at", null);
  oldTokens = role === "school"
    ? oldTokens.eq("school_id", account.id!)
    : oldTokens.is("school_id", null);
  await oldTokens;
  const inserted = await admin.from("app_password_resets").insert({
    token_hash: tokenHash,
    role,
    school_id: role === "school" ? account.id : null,
    expires_at: expiresAt,
  });
  if (inserted.error) {
    console.error(
      "Password reset token creation failed",
      inserted.error.message,
    );
    return json({ ok: true, message: genericMessage });
  }

  const resetUrl = new URL(publicSite);
  resetUrl.search = "";
  resetUrl.hash = "";
  resetUrl.searchParams.set("reset_token", token);
  const html =
    `<div style="font-family:Arial,sans-serif;line-height:1.7;color:#172033"><h2>ตั้งรหัสผ่านใหม่</h2><p>บัญชี: <b>${
      escapeHtml(account.name)
    }</b></p><p>กดปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ ลิงก์นี้ใช้ได้ครั้งเดียวและหมดอายุภายใน 30 นาที</p><p><a href="${
      escapeHtml(resetUrl.toString())
    }" style="display:inline-block;background:#175cd3;color:white;padding:12px 20px;border-radius:8px;text-decoration:none">ตั้งรหัสผ่านใหม่</a></p><p style="color:#667085;font-size:13px">หากคุณไม่ได้ขอเปลี่ยนรหัสผ่าน สามารถละเว้นอีเมลนี้ได้</p></div>`;
  const mail = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [email],
      subject: "ตั้งรหัสผ่านใหม่ — ระบบคุมเงินนอกงบประมาณ",
      html,
    }),
  });
  if (!mail.ok) {
    console.error(
      "Password reset email failed",
      mail.status,
      await mail.text(),
    );
    await admin.from("app_password_resets").delete().eq(
      "token_hash",
      tokenHash,
    );
    return json({ ok: true, message: genericMessage });
  }
  return json({ ok: true, message: genericMessage });
});
