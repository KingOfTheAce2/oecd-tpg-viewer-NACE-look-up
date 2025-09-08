/**
 * Agriculture Support Services Validation Tests
 * Ensures NAICS agriculture support codes (115xxx) are correctly mapped to agriculture NACE codes (01.xx), not manufacturing (16.xx)
 * This prevents regression of the critical agriculture → manufacturing misclassification error
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Agriculture Support Services Classification Validation', () => {
  let crosswalkData;
  
  beforeAll(() => {
    // Load the main crosswalk data
    const crosswalkPath = path.join(__dirname, '../crosswalks/NAICS_2022_to_NACE_Rev21_crosswalk.json');
    const rawData = fs.readFileSync(crosswalkPath, 'utf8');
    crosswalkData = JSON.parse(rawData);
  });

  describe('Critical NAICS 115116 Farm Management Services Mapping', () => {
    test('NAICS 115116 should map to agriculture NACE codes, not manufacturing', () => {
      const farmMgmtEntries = crosswalkData.crosswalk.filter(
        entry => entry.naics2022Code === '115116'
      );
      
      expect(farmMgmtEntries.length).toBeGreaterThan(0);
      
      farmMgmtEntries.forEach(entry => {
        // Ensure it maps to agriculture (01.xx) not manufacturing (16.xx)
        expect(entry.naceRev21Code).toMatch(/^01\./);
        expect(entry.naceRev21Code).not.toMatch(/^16\./);
        
        // Ensure proper agriculture titles
        expect(entry.naceRev21Title).toMatch(/support activities|agriculture/i);
        expect(entry.naceRev21Title).not.toMatch(/wood|sawmilling|manufacture/i);
        
        // Verify ISIC intermediate mapping is correct
        expect(['161', '162']).toContain(entry.isicRev4Code);
        expect(entry.isicRev4Title).toMatch(/support activities/i);
      });
    });

    test('Farm Management Services crop activities should map to NACE 01.61', () => {
      const cropMgmtEntry = crosswalkData.crosswalk.find(
        entry => entry.naics2022Code === '115116' && entry.isicRev4Code === '161'
      );
      
      expect(cropMgmtEntry).toBeDefined();
      expect(cropMgmtEntry.naceRev21Code).toBe('01.61');
      expect(cropMgmtEntry.naceRev21Title).toBe('Support activities for crop production');
      expect(cropMgmtEntry.mappingNotes).toMatch(/crop farm management/i);
    });

    test('Farm Management Services animal activities should map to NACE 01.62', () => {
      const animalMgmtEntry = crosswalkData.crosswalk.find(
        entry => entry.naics2022Code === '115116' && entry.isicRev4Code === '162'
      );
      
      expect(animalMgmtEntry).toBeDefined();
      expect(animalMgmtEntry.naceRev21Code).toBe('01.62');
      expect(animalMgmtEntry.naceRev21Title).toBe('Support activities for animal production');
      expect(animalMgmtEntry.mappingNotes).toMatch(/animal farm management/i);
    });
  });

  describe('Other Agriculture Support Services Mapping Validation', () => {
    const agricultureSupportCodes = [
      { naics: '115112', title: 'Soil Preparation, Planting, and Cultivating' },
      { naics: '115113', title: 'Crop Harvesting, Primarily by Machine' },
      { naics: '115115', title: 'Farm Labor Contractors and Crew Leaders' }
    ];

    test.each(agricultureSupportCodes)('NAICS $naics ($title) should map to agriculture NACE 01.61', ({ naics, title }) => {
      const entries = crosswalkData.crosswalk.filter(
        entry => entry.naics2022Code === naics
      );
      
      expect(entries.length).toBeGreaterThan(0);
      
      entries.forEach(entry => {
        expect(entry.naics2022Title).toBe(title);
        expect(entry.naceRev21Code).toBe('01.61');
        expect(entry.naceRev21Title).toBe('Support activities for crop production');
        
        // Ensure NOT mapped to manufacturing
        expect(entry.naceRev21Code).not.toMatch(/^16\./);
        expect(entry.naceRev21Title).not.toMatch(/wood|sawmilling|manufacture/i);
      });
    });
  });

  describe('Sector Classification Validation', () => {
    test('No NAICS 115xxx codes should map to NACE Section C (Manufacturing)', () => {
      const agricultureSupportEntries = crosswalkData.crosswalk.filter(
        entry => entry.naics2022Code.startsWith('115')
      );
      
      expect(agricultureSupportEntries.length).toBeGreaterThan(0);
      
      agricultureSupportEntries.forEach(entry => {
        // Section C Manufacturing codes start with: 10-33
        const manufacturingSectionRegex = /^(1[0-9]|2[0-9]|3[0-3])\./;
        expect(entry.naceRev21Code).not.toMatch(manufacturingSectionRegex);
        
        // Specifically check for problematic wood manufacturing codes
        expect(entry.naceRev21Code).not.toMatch(/^16\.[12]/); // 16.1 Sawmilling, 16.2 Wood products
        expect(entry.naceRev21Code).not.toMatch(/^15\./); // 15.x Leather/footwear manufacturing
      });
    });

    test('All NAICS 115xxx codes should map to NACE Section A (Agriculture)', () => {
      const agricultureSupportEntries = crosswalkData.crosswalk.filter(
        entry => entry.naics2022Code.startsWith('115')
      );
      
      agricultureSupportEntries.forEach(entry => {
        // Section A Agriculture codes: 01, 02, 03
        expect(entry.naceRev21Code).toMatch(/^0[123]\./);
        
        // Most should map to 01.6x (Support activities to agriculture)
        if (entry.isicRev4Code === '161' || entry.isicRev4Code === '162') {
          expect(entry.naceRev21Code).toMatch(/^01\.6[12]/);
        }
      });
    });
  });

  describe('ISIC → NACE Mapping Chain Validation', () => {
    test('ISIC 161 (crop support) should map to NACE 01.61, never 16.1', () => {
      const isic161Entries = crosswalkData.crosswalk.filter(
        entry => entry.isicRev4Code === '161'
      );
      
      isic161Entries.forEach(entry => {
        if (entry.naics2022Code.startsWith('115')) {
          expect(entry.naceRev21Code).toBe('01.61');
          expect(entry.naceRev21Title).toBe('Support activities for crop production');
          expect(entry.naceRev21Code).not.toBe('16.1'); // Never wood sawmilling!
        }
      });
    });

    test('ISIC 162 (animal support) should map to NACE 01.62, never 16.2', () => {
      const isic162Entries = crosswalkData.crosswalk.filter(
        entry => entry.isicRev4Code === '162'
      );
      
      isic162Entries.forEach(entry => {
        if (entry.naics2022Code.startsWith('115')) {
          expect(entry.naceRev21Code).toBe('01.62');
          expect(entry.naceRev21Title).toBe('Support activities for animal production');
          expect(entry.naceRev21Code).not.toBe('16.2'); // Never wood products!
        }
      });
    });
  });

  describe('Data Quality and Metadata Validation', () => {
    test('Corrected entries should have proper metadata indicating the fix', () => {
      const correctedCodes = ['115112', '115113', '115115', '115116'];
      
      correctedCodes.forEach(naicsCode => {
        const entries = crosswalkData.crosswalk.filter(
          entry => entry.naics2022Code === naicsCode
        );
        
        entries.forEach(entry => {
          expect(entry.mappingPath).toMatch(/corrected agriculture mapping/i);
          expect(entry.mappingNotes).toMatch(/corrected.*manufacturing.*agriculture/i);
        });
      });
    });

    test('NACE update info should reflect agriculture classification', () => {
      const correctedCodes = ['115112', '115113', '115115', '115116'];
      
      correctedCodes.forEach(naicsCode => {
        const entries = crosswalkData.crosswalk.filter(
          entry => entry.naics2022Code === naicsCode
        );
        
        entries.forEach(entry => {
          expect(entry.naceUpdateInfo.mappingType).toMatch(/01\.6[12]/);
          expect(entry.naceUpdateInfo.correspondenceType).toBe('1:1');
          expect(entry.naceUpdateInfo.commonContent).toMatch(/fully covered/);
        });
      });
    });
  });

  describe('Cross-File Consistency Validation', () => {
    test('CSV file should have same corrections as JSON file', () => {
      const csvPath = path.join(__dirname, '../crosswalks/NAICS_2022_to_NACE_Rev21_crosswalk.csv');
      const csvContent = fs.readFileSync(csvPath, 'utf8');
      
      // Check that problematic manufacturing mappings are gone
      expect(csvContent).not.toMatch(/115112.*16\.1.*Sawmilling/);
      expect(csvContent).not.toMatch(/115113.*16\.1.*Sawmilling/);
      expect(csvContent).not.toMatch(/115115.*16\.1.*Sawmilling/);
      expect(csvContent).not.toMatch(/115116.*16\.1.*Sawmilling/);
      expect(csvContent).not.toMatch(/115116.*16\.2.*wood.*products/);
      
      // Check that correct agriculture mappings exist
      expect(csvContent).toMatch(/115112.*01\.61.*Support activities for crop production/);
      expect(csvContent).toMatch(/115113.*01\.61.*Support activities for crop production/);
      expect(csvContent).toMatch(/115115.*01\.61.*Support activities for crop production/);
      expect(csvContent).toMatch(/115116.*01\.61.*Support activities for crop production/);
      expect(csvContent).toMatch(/115116.*01\.62.*Support activities for animal production/);
    });

    test('All data files should be synchronized', () => {
      const mainPath = path.join(__dirname, '../crosswalks/NAICS_2022_to_NACE_Rev21_crosswalk.json');
      const docsPath = path.join(__dirname, '../docs/data/naics_nace_crosswalk.json');
      const publicPath = path.join(__dirname, '../public/data/naics_nace_crosswalk.json');
      
      const mainData = fs.readFileSync(mainPath, 'utf8');
      const docsData = fs.readFileSync(docsPath, 'utf8');
      const publicData = fs.readFileSync(publicPath, 'utf8');
      
      expect(docsData).toBe(mainData);
      expect(publicData).toBe(mainData);
    });
  });
});

describe('Regression Prevention', () => {
  test('Agriculture support services should never be classified as manufacturing', () => {
    // This test acts as a canary to prevent future regressions
    const agriculturalISICCodes = ['161', '162', '163', '164']; // ISIC agriculture support codes
    const manufacturingNACEPattern = /^(1[0-9]|2[0-9]|3[0-3])\./; // NACE Section C Manufacturing
    
    crosswalkData.crosswalk.forEach(entry => {
      if (agriculturalISICCodes.includes(entry.isicRev4Code)) {
        expect(entry.naceRev21Code).not.toMatch(manufacturingNACEPattern);
        expect(entry.naceRev21Title).not.toMatch(/manufacture|wood|sawmilling|footwear/i);
      }
    });
  });
});