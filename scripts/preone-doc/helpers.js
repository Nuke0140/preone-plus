// helpers.js — shared builders for the PreOne Canonical Product Flow audit document
const {
  Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType, HeadingLevel,
  WidthType, BorderStyle, ShadingType, TableLayoutType,
} = require("docx");

// ---------- Palette: DM-1 Deep Cyan (cover) + darkened body/table tokens ----------
const PAL = {
  cover: {
    bg: "162235", titleColor: "FFFFFF", subtitleColor: "B0B8C0",
    metaColor: "90989F", footerColor: "687078", accent: "37DCF2",
  },
  primary: "1B6B7A",      // heading color (darkened accent, safe on white)
  body: "000000",         // Profile A: pure black body
  secondary: "506070",    // captions / secondary
  table: {
    headerBg: "1B6B7A", headerText: "FFFFFF",
    accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5",
  },
  callout: { bg: "EDF3F5", bar: "1B6B7A", warn: "8A4B08", warnBg: "FBF3E6" },
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };

const FONT_BODY = { ascii: "Times New Roman", eastAsia: "Times New Roman" };
const FONT_HEAD = { ascii: "Times New Roman", eastAsia: "Times New Roman" };
const FONT_MONO = { ascii: "Courier New", eastAsia: "Courier New" };

function safeText(v, ph) {
  if (v === undefined || v === null || v === "" || String(v) === "NaN" || String(v) === "undefined") {
    return ph || "[not specified]";
  }
  return String(v);
}

// ---------- Headings ----------
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 420, after: 160, line: 380, lineRule: "atLeast" },
    children: [new TextRun({ text: safeText(text), bold: true, size: 32, color: PAL.primary, font: FONT_HEAD })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120, line: 340, lineRule: "atLeast" },
    children: [new TextRun({ text: safeText(text), bold: true, size: 28, color: PAL.primary, font: FONT_HEAD })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 220, after: 100, line: 312 },
    children: [new TextRun({ text: safeText(text), bold: true, size: 24, color: "1F2A30", font: FONT_HEAD })],
  });
}

// ---------- Body paragraphs ----------
function p(textOrRuns, opts = {}) {
  const runs = Array.isArray(textOrRuns)
    ? textOrRuns
    : [new TextRun({ text: safeText(textOrRuns), size: 24, color: PAL.body, font: FONT_BODY })];
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: opts.after !== undefined ? opts.after : 120, before: opts.before || 0 },
    keepNext: opts.keepNext || false,
    children: runs,
  });
}
function r(text, o = {}) {
  return new TextRun({
    text: safeText(text), size: o.size || 24, bold: o.bold || false, italics: o.italics || false,
    color: o.color || PAL.body, font: o.mono ? FONT_MONO : FONT_BODY,
  });
}
// Lead-in bold label + normal text in one paragraph
function pl(label, text, opts = {}) {
  return p([
    r(label, { bold: true, color: opts.labelColor || PAL.primary }),
    r(text),
  ], opts);
}

// ---------- Bullets (left aligned, never justified) ----------
function bullets(items, opts = {}) {
  return items.map((it) => {
    const runs = Array.isArray(it) ? it : [new TextRun({ text: safeText(it), size: 24, color: PAL.body, font: FONT_BODY })];
    return new Paragraph({
      bullet: { level: opts.level || 0 },
      alignment: AlignmentType.LEFT,
      spacing: { line: 312, after: 60 },
      children: runs,
    });
  });
}

// ---------- Tables ----------
// headers: string[]; rows: string[][] (or {text, bold} cells); widths: number[] percentages
function tbl(headers, rows, widths, opts = {}) {
  const cellSize = opts.cellSize || 20;
  const headCells = headers.map((htext, i) => new TableCell({
    shading: { type: ShadingType.CLEAR, fill: PAL.table.headerBg },
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    width: { size: widths[i], type: WidthType.PERCENTAGE },
    children: [new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { line: 264 },
      children: [new TextRun({ text: safeText(htext), bold: true, size: cellSize, color: PAL.table.headerText, font: FONT_BODY })],
    })],
  }));
  const dataRows = rows.map((row, ri) => new TableRow({
    cantSplit: true,
    children: row.map((cell, ci) => {
      const isObj = cell !== null && typeof cell === "object";
      const text = isObj ? cell.text : cell;
      return new TableCell({
        shading: (ri % 2 === 1 && !opts.noZebra) ? { type: ShadingType.CLEAR, fill: PAL.table.surface } : undefined,
        margins: { top: 60, bottom: 60, left: 100, right: 100 },
        width: { size: widths[ci], type: WidthType.PERCENTAGE },
        children: [new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { line: 264 },
          children: [new TextRun({
            text: safeText(text), size: cellSize,
            bold: isObj ? !!cell.bold : false,
            color: isObj && cell.color ? cell.color : PAL.body,
            font: isObj && cell.mono ? FONT_MONO : FONT_BODY,
          })],
        })],
      });
    }),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 6, color: PAL.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: PAL.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: PAL.table.innerLine },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: PAL.table.innerLine },
    },
    rows: [new TableRow({ tableHeader: true, cantSplit: true, children: headCells }), ...dataRows],
  });
}
// Table caption (keepNext so it stays with the table)
function cap(text) {
  return new Paragraph({
    keepNext: true,
    alignment: AlignmentType.LEFT,
    spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text: safeText(text), bold: true, size: 21, color: PAL.secondary, font: FONT_BODY })],
  });
}

// ---------- Callout (canonical rule / conflict marker) ----------
function note(label, text, kind = "info") {
  const bar = kind === "warn" ? PAL.callout.warn : PAL.callout.bar;
  const bg = kind === "warn" ? PAL.callout.warnBg : PAL.callout.bg;
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 300, before: 120, after: 140 },
    indent: { left: 200, right: 120 },
    border: { left: { style: BorderStyle.SINGLE, size: 16, color: bar, space: 10 } },
    shading: { type: ShadingType.CLEAR, fill: bg },
    children: [
      new TextRun({ text: label + "  ", bold: true, size: 22, color: bar, font: FONT_BODY }),
      new TextRun({ text: safeText(text), size: 22, color: "222222", font: FONT_BODY }),
    ],
  });
}

// ---------- Flow / state-machine blocks (monospace, left aligned) ----------
function flow(lines, opts = {}) {
  return lines.map((line, i) => new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: {
      line: 276, lineRule: "atLeast",
      after: i === lines.length - 1 ? 140 : 0,
      before: i === 0 ? (opts.before || 60) : 0,
    },
    indent: { left: 240 },
    children: [new TextRun({ text: line.length ? line : " ", size: 18, color: "2A3439", font: FONT_MONO })],
  }));
}

module.exports = {
  PAL, NB, noBorders, allNoBorders, FONT_BODY, FONT_HEAD, FONT_MONO,
  safeText, h1, h2, h3, p, r, pl, bullets, tbl, cap, note, flow,
};
