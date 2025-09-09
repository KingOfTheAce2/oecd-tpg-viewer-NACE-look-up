const fs = require('fs');
const path = require('path');

describe('NACE Rev 2.1 Code Specificity Validation', () => {
    let crosswalkData;
    
    beforeAll(() => {
        const crosswalkPath = path.join(__dirname, '../crosswalks/NAICS_2022_to_NACE_Rev21_crosswalk.json');
        const rawData = fs.readFileSync(crosswalkPath, 'utf8');
        crosswalkData = JSON.parse(rawData);
    });
    
    test('should not contain 2-digit division codes without decimals', () => {
        const divisionCodes = crosswalkData.crosswalk.filter(entry => 
            entry.naceRev21Code && /^[0-9]{1,2}$/.test(entry.naceRev21Code)
        );
        
        console.log(`Found ${divisionCodes.length} division codes (should be 0):`);
        divisionCodes.slice(0, 5).forEach(entry => {
            console.log(`  NAICS ${entry.naics2022Code} -> NACE ${entry.naceRev21Code} (${entry.naceRev21Title})`);
        });
        
        expect(divisionCodes.length).toBe(0);
    });
    
    test('should minimize 3-digit group codes (XX.X format)', () => {
        const groupCodes = crosswalkData.crosswalk.filter(entry => 
            entry.naceRev21Code && /^[0-9]{1,2}\.[0-9]{1}$/.test(entry.naceRev21Code)
        );
        
        console.log(`Found ${groupCodes.length} group codes (should be minimal):`);
        groupCodes.slice(0, 5).forEach(entry => {
            console.log(`  NAICS ${entry.naics2022Code} -> NACE ${entry.naceRev21Code} (${entry.naceRev21Title})`);
        });
        
        // Allow some group codes but they should be less than 10% of total
        const totalMappings = crosswalkData.crosswalk.filter(entry => entry.naceRev21Code).length;
        const groupPercentage = (groupCodes.length / totalMappings) * 100;
        
        expect(groupPercentage).toBeLessThan(10);
    });
    
    test('should prefer 4-digit class codes (XX.XX format)', () => {
        const classCodes = crosswalkData.crosswalk.filter(entry => 
            entry.naceRev21Code && /^[0-9]{1,2}\.[0-9]{2}$/.test(entry.naceRev21Code)
        );
        
        const totalMappings = crosswalkData.crosswalk.filter(entry => entry.naceRev21Code).length;
        const classPercentage = (classCodes.length / totalMappings) * 100;
        
        console.log(`Class codes (4-digit): ${classCodes.length} / ${totalMappings} (${classPercentage.toFixed(1)}%)`);
        
        // At least 90% should be 4-digit specific class codes
        expect(classPercentage).toBeGreaterThan(90);
    });
    
    test('should validate NACE code format structure', () => {
        const invalidCodes = crosswalkData.crosswalk.filter(entry => {
            if (!entry.naceRev21Code) return false;
            
            // Valid NACE codes should be:
            // - 4-digit: XX.XX (class codes - preferred)
            // - 3-digit: XX.X (group codes - acceptable but minimal)
            // - 2-digit: XX (division codes - should not exist in final mappings)
            // - 1-digit: X (section codes - should not exist in final mappings)
            
            return !/^[0-9]{1,2}(\.[0-9]{1,2})?$/.test(entry.naceRev21Code);
        });
        
        console.log(`Found ${invalidCodes.length} invalid NACE code formats:`);
        invalidCodes.slice(0, 3).forEach(entry => {
            console.log(`  Invalid: ${entry.naceRev21Code}`);
        });
        
        expect(invalidCodes.length).toBe(0);
    });
    
    test('should ensure mappings have consistent hierarchy preference', () => {
        const mappingStats = {
            sections: 0,      // Level 1: A, B, C
            divisions: 0,     // Level 2: 01, 02, 10
            groups: 0,        // Level 3: 01.1, 01.2, 10.1
            classes: 0        // Level 4: 01.11, 01.12, 10.11 (PREFERRED)
        };
        
        crosswalkData.crosswalk.forEach(entry => {
            if (!entry.naceRev21Code) return;
            
            const code = entry.naceRev21Code;
            if (/^[A-Z]$/.test(code)) {
                mappingStats.sections++;
            } else if (/^[0-9]{1,2}$/.test(code)) {
                mappingStats.divisions++;
            } else if (/^[0-9]{1,2}\.[0-9]{1}$/.test(code)) {
                mappingStats.groups++;
            } else if (/^[0-9]{1,2}\.[0-9]{2}$/.test(code)) {
                mappingStats.classes++;
            }
        });
        
        console.log('NACE code hierarchy distribution:', mappingStats);
        
        // Validate hierarchy preferences
        expect(mappingStats.sections).toBe(0); // No section codes in final mappings
        expect(mappingStats.divisions).toBe(0); // No division codes in final mappings
        expect(mappingStats.classes).toBeGreaterThan(mappingStats.groups * 9); // At least 90% should be class codes
    });
    
    test('should validate mapping quality indicators', () => {
        const qualityStats = {
            direct: 0,
            inferred: 0,
            failed: 0
        };
        
        crosswalkData.crosswalk.forEach(entry => {
            const quality = entry.mappingQuality || 'unknown';
            if (qualityStats.hasOwnProperty(quality)) {
                qualityStats[quality]++;
            }
        });
        
        console.log('Mapping quality distribution:', qualityStats);
        
        // Most mappings should be direct or inferred, very few should fail
        const totalMappings = qualityStats.direct + qualityStats.inferred + qualityStats.failed;
        const successRate = ((qualityStats.direct + qualityStats.inferred) / totalMappings) * 100;
        
        expect(successRate).toBeGreaterThan(95);
    });
});