import Papa from 'papaparse';
global.Papa = Papa;
import { parseCsvText, buildHierarchy } from '../docs/assets/chartpal/parser.js';

test('parseCsvText throws on missing id', () => {
  const csv = 'id,parent_id,name\n,0,Root';
  expect(() => parseCsvText(csv)).toThrow(/Missing id/);
});

test('buildHierarchy throws on duplicate id', () => {
  const records = [
    { id: '1', parent_id: '0' },
    { id: '1', parent_id: '0' }
  ];
  expect(() => buildHierarchy(records)).toThrow(/Duplicate id/);
});
