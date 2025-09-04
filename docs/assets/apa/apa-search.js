import fs from 'fs';
import Papa from 'papaparse';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export const APA_COLUMNS = [
  'Documentnummer',
  'Aantal transacties',
  'Datum van publicatie',
  'Start looptijd',
  'Einde looptijd',
  'Type verzoek',
  'Vaste inrichting',
  'Branche, industrie of sector',
  'Partij 1',
  'Partij 2',
  "Functies, activa en risico's van partij 1",
  "Functies, activa en risico's van partij 2",
  'Transactie',
  'Methode',
  'Lower quartile',
  'Upper quartile',
  'Opmerking',
  'Edge case?'
];

export function loadApaData(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  if (ext === 'csv') {
    const text = fs.readFileSync(filePath, 'utf8');
    const result = Papa.parse(text, { header: true, skipEmptyLines: true });
    return result.data;
  } else if (ext === 'xlsx' || ext === 'xls') {
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }
  throw new Error('Unsupported file type');
}

export function searchApaData(records, criteria) {
  return records.filter(rec => {
    return Object.entries(criteria).every(([key, value]) => {
      if (!value) return true;
      const field = rec[key];
      return field && field.toString().toLowerCase().includes(String(value).toLowerCase());
    });
  });
}
