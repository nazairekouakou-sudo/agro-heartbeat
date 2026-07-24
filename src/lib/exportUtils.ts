// Utilitaires d'export CSV / PDF pour les rapports.
// PDF = impression navigateur (aucune dépendance, fiable, universel).

export function exportToCsv(filename: string, columns: string[], rows: (string | number)[][]) {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [columns.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))];
  const csv = "\uFEFF" + lines.join("\n"); // BOM pour Excel + accents
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportToPdf(title: string, columns: string[], rows: (string | number)[][], subtitle?: string) {
  const win = window.open("", "_blank");
  if (!win) return;
  const style = `
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 28px; color: #1a1a1a; }
    h1 { font-size: 19px; margin: 0 0 4px; }
    .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #ddd; padding: 6px 9px; text-align: left; }
    th { background: #f4f1ea; font-weight: 600; }
    tr:nth-child(even) td { background: #fafaf8; }
  `;
  const rowsHtml = rows
    .map((r) => `<tr>${r.map((c) => `<td>${String(c ?? "")}</td>`).join("")}</tr>`)
    .join("");
  win.document.write(`
    <html><head><title>${title}</title><style>${style}</style></head>
    <body>
      <h1>${title}</h1>
      <div class="meta">CAPI ERP${subtitle ? " · " + subtitle : ""} · Généré le ${new Date().toLocaleString("fr-FR")}</div>
      <table><thead><tr>${columns.map((c) => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rowsHtml}</tbody></table>
      <script>window.onload = () => window.print();</script>
    </body></html>
  `);
  win.document.close();
}
