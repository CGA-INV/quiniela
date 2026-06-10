"use client";

/**
 * Botones de exportación de la evidencia: descarga CSV (abre en Excel/Sheets)
 * e impresión a PDF (vía el diálogo de impresión del navegador → "Guardar como PDF").
 * El contenido CSV se arma en el servidor y se pasa ya listo.
 */
export function EvidenceExport({ csv, fileName }: { csv: string; fileName: string }) {
  function downloadCsv() {
    // BOM para que Excel respete los acentos (UTF-8).
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="no-print flex flex-wrap gap-2">
      <button
        type="button"
        onClick={downloadCsv}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 active:scale-95"
      >
        ⬇ Descargar Excel (CSV)
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700 active:scale-95"
      >
        🖨 Imprimir / Guardar PDF
      </button>
    </div>
  );
}
