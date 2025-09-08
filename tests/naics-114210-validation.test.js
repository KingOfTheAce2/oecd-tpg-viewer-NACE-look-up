import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('NAICS 114210 Hunting and Trapping - Crosswalk Validation', () => {
  let crosswalkData;
  
  beforeAll(() => {
    // Load the crosswalk data
    const crosswalkPath = path.join(__dirname, '..', 'crosswalks', 'NAICS_2022_to_NACE_Rev21_crosswalk.json');
    const rawData = fs.readFileSync(crosswalkPath, 'utf8');
    const jsonData = JSON.parse(rawData);
    
    // Handle different JSON structures
    if (jsonData && typeof jsonData === 'object' && 'crosswalk' in jsonData) {
      crosswalkData = jsonData.crosswalk;
    } else if (jsonData && typeof jsonData === 'object' && 'mappings' in jsonData) {
      crosswalkData = jsonData.mappings;
    } else if (Array.isArray(jsonData)) {
      crosswalkData = jsonData;
    } else {
      crosswalkData = [jsonData];
    }
  });

  test('NAICS 114210 should map to correct NACE code 01.70', () => {
    // Find all mappings for NAICS 114210
    const naics114210Mappings = crosswalkData.filter(
      record => record.naics2022Code === '114210'
    );

    expect(naics114210Mappings.length).toBeGreaterThan(0);

    // Check that at least one mapping goes to NACE 01.70
    const correctMapping = naics114210Mappings.find(
      record => record.naceRev21Code === '01.70'
    );

    expect(correctMapping).toBeDefined();
    expect(correctMapping.naceRev21Title).toBe('Hunting, trapping and related service activities');
  });

  test('NAICS 114210 should NOT map to manufacturing NACE codes 17.x', () => {
    // Find all mappings for NAICS 114210
    const naics114210Mappings = crosswalkData.filter(
      record => record.naics2022Code === '114210'
    );

    // Check that NO mappings go to NACE 17.x (manufacturing paper products)
    const incorrectManufacturingMappings = naics114210Mappings.filter(
      record => record.naceRev21Code?.startsWith('17.')
    );

    expect(incorrectManufacturingMappings).toHaveLength(0);
  });

  test('NAICS 114210 should have consistent ISIC mapping', () => {
    // Find all mappings for NAICS 114210
    const naics114210Mappings = crosswalkData.filter(
      record => record.naics2022Code === '114210'
    );

    // All should map to ISIC 170 "Hunting, trapping and related service activities"
    naics114210Mappings.forEach(record => {
      expect(record.isicRev4Code).toBe('170');
      expect(record.isicRev4Title).toBe('Hunting, trapping and related service activities');
    });
  });

  test('NAICS 114210 should have correct NAICS title', () => {
    // Find all mappings for NAICS 114210
    const naics114210Mappings = crosswalkData.filter(
      record => record.naics2022Code === '114210'
    );

    naics114210Mappings.forEach(record => {
      expect(record.naics2022Title).toBe('Hunting and Trapping');
    });
  });

  test('Agriculture/Forestry/Fishing NAICS codes should not map to Manufacturing NACE Section C', () => {
    // Find all NAICS codes in Agriculture, Forestry, Fishing, and Hunting (11xxxx)
    const agricultureMappings = crosswalkData.filter(
      record => record.naics2022Code?.startsWith('11')
    );

    // Check that none map to NACE Section C (Manufacturing - codes 10-33)
    const manufacturingMappings = agricultureMappings.filter(record => {
      const naceCode = record.naceRev21Code;
      if (!naceCode) return false;
      
      const naceNumber = parseFloat(naceCode);
      return naceNumber >= 10 && naceNumber < 34;
    });

    if (manufacturingMappings.length > 0) {
      console.error('Agriculture NAICS codes incorrectly mapped to Manufacturing NACE:', 
        manufacturingMappings.map(m => ({
          naics: m.naics2022Code,
          naicsTitle: m.naics2022Title,
          nace: m.naceRev21Code,
          naceTitle: m.naceRev21Title
        }))
      );
    }

    expect(manufacturingMappings).toHaveLength(0);
  });
});

describe('NAICS 114210 CSV Crosswalk Validation', () => {
  let csvData;

  beforeAll(async () => {
    const { default: Papa } = await import('papaparse');
    const csvPath = path.join(__dirname, '..', 'crosswalks', 'NAICS_2022_to_NACE_Rev21_crosswalk.csv');
    const csvText = fs.readFileSync(csvPath, 'utf8');
    csvData = Papa.parse(csvText, { header: true }).data;
  });

  test('CSV should have correct NAICS 114210 mapping to NACE 01.70', () => {
    const naics114210Records = csvData.filter(
      record => record.NAICS_2022_Code === '114210'
    );

    expect(naics114210Records.length).toBeGreaterThan(0);

    // Should have at least one mapping to NACE 01.70
    const correctMapping = naics114210Records.find(
      record => record.NACE_Rev21_Code === '01.70'
    );

    expect(correctMapping).toBeDefined();
  });

  test('CSV should NOT have NAICS 114210 mapping to NACE 17.x', () => {
    const naics114210Records = csvData.filter(
      record => record.NAICS_2022_Code === '114210'
    );

    // Should NOT have any mappings to NACE 17.x
    const incorrectMappings = naics114210Records.filter(
      record => record.NACE_Rev21_Code?.startsWith('17.')
    );

    expect(incorrectMappings).toHaveLength(0);
  });
});