import { formatDate } from '../shared/time.js';
import { MSG } from '../shared/messages.js';
import { statusLabel } from '../shared/labels.js';

export function quoteCsv(value, defects) {
  const text = String(value);
  // CB_CSV_COMMAS_UNQUOTED (Names containing commas are not quoted in CSV)
  if (defects.CB_CSV_COMMAS_UNQUOTED) return text;
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** File name of the export: appointments-YYYY-MM-DD.csv */
export function reportFileName(date, extension, defects) {
  const [y, m, d] = date.split('-');
  // CB_CSV_NAME_DD_MM_YYYY (CSV file name uses DD-MM-YYYY)
  return defects.CB_CSV_NAME_DD_MM_YYYY ? `appointments-${d}-${m}-${y}.${extension}` : `appointments-${date}.${extension}`;
}

/** rows: [{ time, patient, doctor, status }] */
export function buildDailyCsv({ date, rows, defects }) {
  const lines = [`ClinicBook - Kunlik qabullar - ${formatDate(date)}`, 'Vaqt,Bemor,Shifokor,Holat'];
  if (rows.length === 0) lines.push(MSG.NO_APPOINTMENTS);
  for (const row of rows) {
    lines.push([row.time, row.patient, row.doctor, statusLabel(row.status)].map((v) => quoteCsv(v, defects)).join(','));
  }
  return `${lines.join('\n')}\n`;
}
