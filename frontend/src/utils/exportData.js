import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

function normalizeValue(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

function normalizeRows(rows = []) {
  return rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, normalizeValue(value)]),
    ),
  );
}

function safeFilename(value = "medaxis-export") {
  return (
    String(value)
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "medaxis-export"
  );
}

function validateExport(rows, columns) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("There is no data to export.");
  }

  if (!Array.isArray(columns) || columns.length === 0) {
    throw new Error("Please specify the columns to export.");
  }
}

export function exportCSV({ title = "MedAxis Report", columns, rows }) {
  validateExport(rows, columns);

  const normalized = normalizeRows(rows);
  const escapeCSV = (value) => {
    const text = String(value ?? "");
    return `"${text.replace(/"/g, '""')}"`;
  };

  const header = columns.map((column) => escapeCSV(column.label));

  const body = normalized.map((row) =>
    columns.map((column) => escapeCSV(row[column.key])),
  );

  const csv = [header.join(","), ...body.map((row) => row.join(","))].join(
    "\r\n",
  );

  // UTF-8 BOM helps Excel display many international characters.
  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8;",
  });

  downloadBlob(blob, `${safeFilename(title)}.csv`);
}

export function exportExcel({
  title = "MedAxis Report",
  sheetName = "Report",
  columns,
  rows,
}) {
  validateExport(rows, columns);

  const normalized = normalizeRows(rows);

  const worksheetRows = [
    columns.map((column) => column.label),
    ...normalized.map((row) => columns.map((column) => row[column.key] ?? "")),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetRows);

  worksheet["!cols"] = columns.map((column) => ({
    wch: Math.min(Math.max(String(column.label).length + 3, 12), 35),
  }));

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    safeFilename(sheetName).slice(0, 31) || "Report",
  );

  XLSX.writeFile(workbook, `${safeFilename(title)}.xlsx`);
}

export function exportPDF({
  title = "MedAxis Report",
  subtitle = "",
  columns,
  rows,
  orientation = "landscape",
}) {
  validateExport(rows, columns);

  const normalized = normalizeRows(rows);
  const doc = new jsPDF({ orientation });

  doc.setFontSize(16);
  doc.text(title, 14, 18);

  if (subtitle) {
    doc.setFontSize(9);
    doc.text(String(subtitle).slice(0, 180), 14, 25);
  }

  autoTable(doc, {
    startY: subtitle ? 32 : 26,
    head: [columns.map((column) => column.label)],
    body: normalized.map((row) =>
      columns.map((column) => String(row[column.key] ?? "")),
    ),
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      overflow: "linebreak",
    },
    headStyles: {
      fontStyle: "bold",
    },
    margin: {
      left: 14,
      right: 14,
      bottom: 18,
    },
  });

  const pageCount = doc.internal.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.text(
      `MedAxis | Page ${page} of ${pageCount}`,
      14,
      doc.internal.pageSize.getHeight() - 8,
    );
  }

  doc.save(`${safeFilename(title)}.pdf`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
