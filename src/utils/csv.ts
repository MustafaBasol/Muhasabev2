type CsvValue = string | number | boolean | null | undefined;

const normalizeCell = (value: CsvValue): string => {
  if (value === null || value === undefined) return '';
  return String(value);
};

export const csvEscape = (value: CsvValue): string => {
  const cell = normalizeCell(value);
  const needsQuotes = /[",\n\r]/.test(cell);
  const escaped = cell.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

export const buildCsv = (headers: string[], rows: CsvValue[][]): string => {
  const headerLine = headers.map(csvEscape).join(',');
  const rowLines = rows.map((row) => row.map(csvEscape).join(','));
  return [headerLine, ...rowLines].join('\n');
};

export const downloadCsvFile = (filename: string, csv: string): void => {
  if (typeof document === 'undefined') return;
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download === undefined) return;
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
