import { loadApaData, searchApaData } from '../docs/assets/apa/apa-search.js';
import path from 'path';

const csvPath = path.join('tests', 'fixtures', 'apa_sample.csv');

test('loadApaData reads CSV', () => {
  const records = loadApaData(csvPath);
  expect(records.length).toBe(2);
  expect(records[0].Documentnummer).toBe('APA001');
});

test('searchApaData finds matching records', () => {
  const records = loadApaData(csvPath);
  const result = searchApaData(records, { 'Partij 1': 'Company A' });
  expect(result.length).toBe(1);
  expect(result[0].Documentnummer).toBe('APA001');
});
