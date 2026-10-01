/**
 * PreOne — Report Export Engine
 *
 * Produces unified CSV, Excel-compatible XML/CSV, and Print-ready HTML
 * from the exact same authoritative dataset.
 */

import { ExportFormat, ReportColumn, ReportResult } from './report-types'

export class ExportEngine {
  /**
   * Generates formatted file content from a single ReportResult dataset.
   */
  static generateExport(
    result: ReportResult,
    format: ExportFormat,
    schoolName = 'PreOne Preschool'
  ): { contentType: string; filename: string; content: string } {
    const timestamp = new Date().toISOString().slice(0, 10)
    const baseFilename = `${result.reportId}_${timestamp}`

    switch (format) {
      case 'CSV': {
        const header = result.columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',')
        const rows = result.data.map((row) =>
          result.columns
            .map((c) => {
              const val = row[c.key] ?? ''
              return `"${String(val).replace(/"/g, '""')}"`
            })
            .join(',')
        )
        const csvContent = [header, ...rows].join('\r\n')
        return {
          contentType: 'text/csv; charset=utf-8',
          filename: `${baseFilename}.csv`,
          content: csvContent,
        }
      }

      case 'XLSX': {
        // Generates Microsoft Excel 2003 XML Spreadsheet (supported natively by Excel and LibreOffice)
        const colXml = result.columns
          .map(() => '<ss:Column ss:AutoFitWidth="1" ss:Width="120"/>')
          .join('')
        const headerCells = result.columns
          .map(
            (c) =>
              `<ss:Cell ss:StyleID="HeaderStyle"><ss:Data ss:Type="String">${escapeXml(
                c.label
              )}</ss:Data></ss:Cell>`
          )
          .join('')

        const dataRows = result.data
          .map((row) => {
            const cells = result.columns
              .map((c) => {
                const val = row[c.key] ?? ''
                return `<ss:Cell><ss:Data ss:Type="String">${escapeXml(String(val))}</ss:Data></ss:Cell>`
              })
              .join('')
            return `<ss:Row>${cells}</ss:Row>`
          })
          .join('')

        const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<ss:Workbook xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <ss:Styles>
    <ss:Style ss:ID="HeaderStyle">
      <ss:Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <ss:Interior ss:Color="#4338CA" ss:Pattern="Solid"/>
    </ss:Style>
  </ss:Styles>
  <ss:Worksheet ss:Name="${escapeXml(result.title.slice(0, 30))}">
    <ss:Table>
      ${colXml}
      <ss:Row>${headerCells}</ss:Row>
      ${dataRows}
    </ss:Table>
  </ss:Worksheet>
</ss:Workbook>`

        return {
          contentType: 'application/vnd.ms-excel; charset=utf-8',
          filename: `${baseFilename}.xls`,
          content: xmlContent,
        }
      }

      case 'PDF':
      case 'PRINT': {
        // High-fidelity Print-ready HTML with print media stylesheets for direct browser PDF generation
        const ths = result.columns
          .map((c) => `<th style="text-align: ${c.align || 'left'}">${escapeXml(c.label)}</th>`)
          .join('')
        const trs = result.data
          .map(
            (row) => `<tr>${result.columns
              .map(
                (c) =>
                  `<td style="text-align: ${c.align || 'left'}">${escapeXml(
                    String(row[c.key] ?? '—')
                  )}</td>`
              )
              .join('')}</tr>`
          )
          .join('')

        const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${escapeXml(result.title)} - ${escapeXml(schoolName)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #0f172a; margin: 0; }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
    .title { font-size: 20px; font-weight: 700; color: #1e1b4b; margin: 0 0 4px 0; }
    .school { font-size: 14px; font-weight: 600; color: #4338ca; }
    .meta { font-size: 12px; color: #64748b; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
    th { background-color: #f1f5f9; padding: 8px 12px; font-weight: 600; border: 1px solid #cbd5e1; }
    td { padding: 8px 12px; border: 1px solid #e2e8f0; }
    tr:nth-child(even) { background-color: #f8fafc; }
    .footer { margin-top: 24px; font-size: 11px; color: #94a3b8; text-align: right; }
    @media print {
      body { padding: 0; }
      @page { margin: 1cm; size: landscape; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="school">${escapeXml(schoolName)}</div>
      <h1 class="title">${escapeXml(result.title)}</h1>
      <div class="meta">Domain: ${escapeXml(result.domain)} | Generated: ${new Date().toLocaleString('en-IN')}</div>
    </div>
    <div class="meta">
      Total Records: <strong>${result.total}</strong>
    </div>
  </div>
  <table>
    <thead><tr>${ths}</tr></thead>
    <tbody>${trs}</tbody>
  </table>
  <div class="footer">PreOne Enterprise Preschool OS — Authoritative Confidential Record</div>
  <script>
    if (window.location.search.includes('print=true')) {
      window.print();
    }
  </script>
</body>
</html>`

        return {
          contentType: 'text/html; charset=utf-8',
          filename: `${baseFilename}.html`,
          content: html,
        }
      }
    }
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
