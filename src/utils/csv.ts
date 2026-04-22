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

/**
 * RFC 4180 uyumlu CSV satır parser.
 * Çift tırnaklı hücreleri (içinde virgül, satır sonu veya tırnak olan değerleri) doğru parse eder.
 * Örnek: "10 Rue de la Paix, Paris","FR" → ['10 Rue de la Paix, Paris', 'FR']
 */
export const parseCsvLine = (line: string): string[] => {
  const result: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      // Tırnaklı hücre
      let cell = '';
      i++; // açış tırnağını atla
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            // Kaçırılmış tırnak ("" → ")
            cell += '"';
            i += 2;
          } else {
            // Kapanış tırnağı
            i++;
            break;
          }
        } else {
          cell += line[i];
          i++;
        }
      }
      result.push(cell);
      // Ayraç virgülünü atla
      if (line[i] === ',') i++;
    } else {
      // Tırnaksız hücre
      const end = line.indexOf(',', i);
      if (end === -1) {
        result.push(line.slice(i).trim());
        break;
      } else {
        result.push(line.slice(i, end).trim());
        i = end + 1;
      }
    }
  }
  // Satır virgülle bitiyorsa son boş hücreyi ekle
  if (line.endsWith(',')) result.push('');
  return result;
};

/**
 * CSV metnini başlık→değer kayıtlarına parse eder.
 * - UTF-8 BOM otomatik temizlenir
 * - Boş satırlar atlanır
 * - RFC 4180 tırnaklı hücreler desteklenir
 */
export const parseCsvText = (text: string): Record<string, string>[] => {
  // BOM temizle
  const cleaned = text.replace(/^\uFEFF/, '');
  const lines = cleaned.split(/\r?\n/);
  const nonEmpty = lines.filter(l => l.trim().length > 0);
  if (nonEmpty.length < 2) return [];

  const headers = parseCsvLine(nonEmpty[0]).map(h => h.replace(/^"|"$/g, '').trim());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < nonEmpty.length; i++) {
    const values = parseCsvLine(nonEmpty[i]);
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx] ?? '';
    });
    // Tüm değerler boşsa satırı atla
    if (Object.values(record).every(v => !v.trim())) continue;
    records.push(record);
  }
  return records;
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
