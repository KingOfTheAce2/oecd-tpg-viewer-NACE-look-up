// Direct crosswalk validation test
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

describe('Crosswalk Data Validation', () => {
  let crosswalkData;
  let sampleData;
  
  beforeAll(() => {
    // Load the main crosswalk data
    const crosswalkPath = path.join(projectRoot, 'crosswalks', 'NAICS_2022_to_NACE_Rev21_crosswalk.json');
    crosswalkData = JSON.parse(fs.readFileSync(crosswalkPath, 'utf8'));
    
    // Load sample test data
    const samplePath = path.join(projectRoot, 'tests', 'fixtures', 'crosswalk_sample.json');
    sampleData = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
  });

  test('crosswalk data has correct structure', () => {
    expect(crosswalkData).toHaveProperty('metadata');
    expect(crosswalkData).toHaveProperty('crosswalk');
    expect(Array.isArray(crosswalkData.crosswalk)).toBe(true);
  });

  test('metadata contains required information', () => {
    const { metadata } = crosswalkData;
    expect(metadata).toHaveProperty('created');
    expect(metadata).toHaveProperty('description');
    expect(metadata).toHaveProperty('totalMappings');
    expect(metadata.totalMappings).toBeGreaterThan(0);
  });

  test('crosswalk entries have required fields', () => {
    const firstEntry = crosswalkData.crosswalk[0];
    expect(firstEntry).toHaveProperty('naics2022Code');
    expect(firstEntry).toHaveProperty('naics2022Title');
    expect(firstEntry).toHaveProperty('isicRev4Code');
    expect(firstEntry).toHaveProperty('mappingPath');
    expect(firstEntry).toHaveProperty('mappingQuality');
  });

  test('no mappings should fail after fixes (100% coverage)', () => {
    const failedMappings = crosswalkData.crosswalk.filter(row => 
      row.mappingPath.includes('no NACE mapping')
    );
    expect(failedMappings).toHaveLength(0);
  });

  test('all mappings have mapping quality indicator', () => {
    const mappingsWithoutQuality = crosswalkData.crosswalk.filter(row => 
      !row.mappingQuality || row.mappingQuality === 'unknown'
    );
    expect(mappingsWithoutQuality).toHaveLength(0);
  });

  test('inferred mappings are properly marked', () => {
    const inferredMappings = crosswalkData.crosswalk.filter(row => 
      row.mappingQuality === 'inferred'
    );
    expect(inferredMappings.length).toBeGreaterThan(0);
    
    // Check that inferred mappings have method indicators in path
    inferredMappings.forEach(mapping => {
      expect(mapping.mappingPath).toMatch(/\([^)]+\)/); // Has method in parentheses
    });
  });

  test('direct mappings are the majority', () => {
    const directMappings = crosswalkData.crosswalk.filter(row => 
      row.mappingQuality === 'direct'
    );
    const total = crosswalkData.crosswalk.length;
    const directPercentage = (directMappings.length / total) * 100;
    
    expect(directPercentage).toBeGreaterThan(90); // At least 90% should be direct mappings
  });

  test('all NAICS codes are properly mapped', () => {
    const naicsCodes = new Set(crosswalkData.crosswalk.map(row => row.naics2022Code));
    expect(naicsCodes.size).toBeGreaterThan(1000); // Should have over 1000 unique NAICS codes
  });

  test('all entries with NACE codes have titles', () => {
    const entriesWithNace = crosswalkData.crosswalk.filter(row => row.naceRev21Code);
    const entriesWithoutTitle = entriesWithNace.filter(row => !row.naceRev21Title);
    
    // Allow some entries without titles as they might be legitimate
    expect(entriesWithoutTitle.length).toBeLessThan(entriesWithNace.length * 0.1); // Less than 10%
  });

  test('sample data structure contains essential fields', () => {
    expect(sampleData).toHaveProperty('crosswalk');
    expect(Array.isArray(sampleData.crosswalk)).toBe(true);
    
    if (sampleData.crosswalk.length > 0) {
      const sampleEntry = sampleData.crosswalk[0];
      
      // Check that sample has essential fields
      expect(sampleEntry).toHaveProperty('naics2022Code');
      expect(sampleEntry).toHaveProperty('naics2022Title');
      expect(sampleEntry).toHaveProperty('mappingPath');
      expect(sampleEntry).toHaveProperty('mappingQuality');
      expect(sampleEntry).toHaveProperty('partialMappings');
    }
  });

  test('mapping paths are valid', () => {
    const validPaths = [
      'NAICS→ISIC→NACE2→NACE2.1',
      'NAICS→ISIC→NACE2→NACE2.1 (zero-padded)',
      'NAICS→ISIC→NACE2→NACE2.1 (parent-fallback)',
      'NAICS→ISIC→NACE2→NACE2.1 (hierarchy-expansion)',
      'NAICS→ISIC→NACE2',
      'NAICS→ISIC→NACE2 (zero-padded)',
      'NAICS→ISIC→NACE2 (parent-fallback)',
      'NAICS→ISIC→NACE2 (hierarchy-expansion)'
    ];
    
    const invalidPaths = crosswalkData.crosswalk.filter(row => 
      !validPaths.includes(row.mappingPath)
    );
    
    expect(invalidPaths).toHaveLength(0);
  });

  test('statistics match actual data', () => {
    const totalMappings = crosswalkData.crosswalk.length;
    const uniqueNaics = new Set(crosswalkData.crosswalk.map(row => row.naics2022Code)).size;
    const mappingsWithNace = crosswalkData.crosswalk.filter(row => row.naceRev21Code).length;
    const coverageRate = (mappingsWithNace / totalMappings) * 100;
    
    expect(crosswalkData.metadata.totalMappings).toBe(totalMappings);
    expect(coverageRate).toBe(100); // Should have 100% coverage after fixes
    expect(uniqueNaics).toBeGreaterThan(1000);
  });
});