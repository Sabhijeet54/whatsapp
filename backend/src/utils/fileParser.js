const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");
const { parseNumbersFromText, normalizeToIndianNumber } = require("./numberParser");

function detectPhoneColumn(columns = []) {
  const scored = columns
    .map((col) => ({
      col,
      score: /phone|mobile|number|contact|whatsapp/i.test(String(col)) ? 2 : 0,
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.col || columns[0] || null;
}

function parseCsvText(text) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((item) => item.trim()));

  if (!rows.length) return { rows: [], columns: [] };

  const hasHeader = rows[0].some((value) => /[a-z]/i.test(value));
  const columns = hasHeader ? rows[0] : rows[0].map((_, index) => `column_${index + 1}`);
  const dataRows = hasHeader ? rows.slice(1) : rows;

  return {
    columns,
    rows: dataRows.map((vals) => {
      const item = {};
      columns.forEach((key, idx) => {
        item[key] = vals[idx] || "";
      });
      return item;
    }),
  };
}

function parseUploadedFile(filePath, originalName, defaultCountryCode = "91") {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === ".txt") {
    const text = fs.readFileSync(filePath, "utf8");
    const parsed = parseNumbersFromText(text, defaultCountryCode);
    return {
      type: "txt",
      previewRows: parsed.validNumbers.slice(0, 10).map((number) => ({ number })),
      columns: ["number"],
      detectedPhoneColumn: "number",
      mappedContacts: parsed.validNumbers.map((number) => ({ number })),
      invalidNumbers: parsed.invalidNumbers,
    };
  }

  if (ext === ".csv") {
    const text = fs.readFileSync(filePath, "utf8");
    const parsedCsv = parseCsvText(text);
    const detectedPhoneColumn = detectPhoneColumn(parsedCsv.columns);
    const mappedContacts = parsedCsv.rows
      .map((row) => {
        const normalized = normalizeToIndianNumber(row[detectedPhoneColumn], defaultCountryCode);
        if (!normalized) return null;
        return {
          number: normalized,
          name: row.name || row.Name || row.full_name || "",
        };
      })
      .filter(Boolean);

    return {
      type: "csv",
      previewRows: parsedCsv.rows.slice(0, 10),
      columns: parsedCsv.columns,
      detectedPhoneColumn,
      mappedContacts,
      invalidNumbers: [],
    };
  }

  if (ext === ".xlsx" || ext === ".xls") {
    const workbook = xlsx.readFile(filePath);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(firstSheet, { defval: "" });
    const columns = rows.length ? Object.keys(rows[0]) : [];
    const detectedPhoneColumn = detectPhoneColumn(columns);

    const mappedContacts = rows
      .map((row) => {
        const normalized = normalizeToIndianNumber(row[detectedPhoneColumn], defaultCountryCode);
        if (!normalized) return null;
        return {
          number: normalized,
          name: row.name || row.Name || row.full_name || "",
        };
      })
      .filter(Boolean);

    return {
      type: "xlsx",
      previewRows: rows.slice(0, 10),
      columns,
      detectedPhoneColumn,
      mappedContacts,
      invalidNumbers: [],
    };
  }

  throw new Error("Unsupported file format. Use .txt, .csv, .xlsx");
}

module.exports = {
  parseUploadedFile,
  detectPhoneColumn,
};
