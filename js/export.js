// ============================================================
//  Export — นำออกเป็นไฟล์ Excel (.xlsx) ด้วย SheetJS
//  ใช้รูปแบบ AOA (array of arrays) + การผสานเซลล์ (merges)
// ============================================================
window.Exporter = (function () {

  // สร้าง worksheet จาก AOA พร้อม merges และความกว้างคอลัมน์
  function sheetFromAOA(aoa, { merges = [], cols = [], numCols = [] } = {}) {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    if (merges.length) ws['!merges'] = merges.map(m => XLSX.utils.decode_range(m));
    if (cols.length) ws['!cols'] = cols.map(w => ({ wch: w }));
    // จัดรูปแบบตัวเลขคอลัมน์เงิน
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (const C of numCols) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (cell && typeof cell.v === 'number') cell.z = '#,##0.00';
      }
    }
    return ws;
  }

  // นำออกไฟล์ (หนึ่งชีต)
  function download(filename, sheetName, aoa, opts) {
    if (!window.XLSX) { U.toast('ยังโหลดไลบรารี Excel ไม่สำเร็จ', 'err'); return; }
    const wb = XLSX.utils.book_new();
    const ws = sheetFromAOA(aoa, opts);
    XLSX.utils.book_append_sheet(wb, ws, (sheetName || 'Sheet1').slice(0, 31));
    XLSX.writeFile(wb, filename, { compression: true });
  }

  // นำออกหลายชีต: sheets = [{name, aoa, opts}]
  function downloadMulti(filename, sheets) {
    if (!window.XLSX) { U.toast('ยังโหลดไลบรารี Excel ไม่สำเร็จ', 'err'); return; }
    const wb = XLSX.utils.book_new();
    sheets.forEach((s, i) => {
      const ws = sheetFromAOA(s.aoa, s.opts);
      XLSX.utils.book_append_sheet(wb, ws, (s.name || ('Sheet' + (i + 1))).slice(0, 31));
    });
    XLSX.writeFile(wb, filename, { compression: true });
  }

  return { download, downloadMulti, sheetFromAOA };
})();
