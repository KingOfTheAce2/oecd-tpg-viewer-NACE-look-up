import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fixCrosswalk() {
    try {
        const csvPath = path.join(__dirname, '../crosswalks/NAICS_2022_to_NACE_Rev21_crosswalk.csv');
        
        console.log('Looking for CSV file at:', csvPath);
        
        if (!fs.existsSync(csvPath)) {
            console.error('CSV file not found:', csvPath);
            return;
        }

        console.log('🔧 FIXING NAICS-NACE CROSSWALK ISSUES...\n');

    const csvData = fs.readFileSync(csvPath, 'utf8');
    const lines = csvData.split('\n');
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    const naceCodeIndex = headers.findIndex(h => h === 'NACE_Rev21_Code');
    const naicsCodeIndex = headers.findIndex(h => h === 'NAICS_2022_Code');
    const naceTitleIndex = headers.findIndex(h => h === 'NACE_Rev21_Title');
    const naicsTitleIndex = headers.findIndex(h => h === 'NAICS_2022_Title');
    
    let fixCount = 0;
    let issuesFound = [];
    
    // Keep header
    let fixedLines = [lines[0]];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const columns = line.split(',').map(col => col.replace(/"/g, '').trim());
        
        if (columns.length <= Math.max(naceCodeIndex, naicsCodeIndex)) {
            fixedLines.push(line);
            continue;
        }
        
        const naceCode = columns[naceCodeIndex];
        const naicsCode = columns[naicsCodeIndex];
        const naceTitle = columns[naceTitleIndex] || '';
        const naicsTitle = columns[naicsTitleIndex] || '';
        
        // Skip header rows and empty codes
        if (!naceCode || naceCode === 'NACE_Rev21_Code') {
            fixedLines.push(line);
            continue;
        }
        
        let shouldFix = false;
        let newNaceCode = naceCode;
        let newNaceTitle = naceTitle;
        let reason = '';
        
        // Fix 1: Agriculture mapped to tobacco manufacturing (weird crossover)
        if ((naicsCode === '111336' || naicsCode === '111998') && naceCode === '12') {
            // NAICS 111336: Fruit and Tree Nut Combination Farming should map to growing of fruits
            // NAICS 111998: All Other Miscellaneous Crop Farming should map to mixed farming
            if (naicsCode === '111336') {
                newNaceCode = '01.25'; // Growing of other tree and bush fruits and nuts
                newNaceTitle = 'Growing of other tree and bush fruits and nuts';
                reason = 'Fixed agriculture->tobacco crossover: Fruit farming to proper agriculture code';
            } else {
                newNaceCode = '01.50'; // Mixed farming  
                newNaceTitle = 'Mixed farming';
                reason = 'Fixed agriculture->tobacco crossover: Mixed crop farming to proper agriculture code';
            }
            shouldFix = true;
        }
        
        // Fix 2: Replace division-level codes (2-digit) with class-level codes (4-digit) where possible
        if (/^[0-9]{2}$/.test(naceCode) && naceCode !== '12') {
            // For most division codes, we can make them more specific
            const divisionCode = naceCode;
            switch(divisionCode) {
                case '01':
                    newNaceCode = '01.19'; // Growing of other non-perennial crops
                    newNaceTitle = 'Growing of other non-perennial crops';
                    reason = 'Made more specific: Division 01 -> Class 01.19';
                    shouldFix = true;
                    break;
                case '02':
                    newNaceCode = '02.10'; // Silviculture and other forestry activities  
                    newNaceTitle = 'Silviculture and other forestry activities';
                    reason = 'Made more specific: Division 02 -> Class 02.10';
                    shouldFix = true;
                    break;
                case '03':
                    newNaceCode = '03.11'; // Marine fishing
                    newNaceTitle = 'Marine fishing';
                    reason = 'Made more specific: Division 03 -> Class 03.11';
                    shouldFix = true;
                    break;
            }
        }
        
        // Apply fixes
        if (shouldFix) {
            // Update the NACE code and title columns
            const newColumns = [...columns];
            newColumns[naceCodeIndex] = newNaceCode;
            newColumns[naceTitleIndex] = newNaceTitle;
            
            const fixedLine = newColumns.map(col => `"${col}"`).join(',');
            fixedLines.push(fixedLine);
            
            fixCount++;
            issuesFound.push({
                line: i + 1,
                naics: naicsCode,
                naicsTitle: naicsTitle,
                oldNace: naceCode,
                newNace: newNaceCode,
                reason: reason
            });
            
            console.log(`Line ${i+1}: NAICS ${naicsCode} (${naicsTitle})`);
            console.log(`  OLD: ${naceCode} (${naceTitle})`); 
            console.log(`  NEW: ${newNaceCode} (${newNaceTitle})`);
            console.log(`  REASON: ${reason}\n`);
        } else {
            fixedLines.push(line);
        }
    }
    
    // Write fixed file
    const fixedContent = fixedLines.join('\n');
    fs.writeFileSync(csvPath, fixedContent);
    
    console.log('=== CROSSWALK FIXES SUMMARY ===');
    console.log(`✅ Fixed ${fixCount} problematic mappings`);
    console.log(`📁 Updated file: ${csvPath}`);
    
    if (fixCount > 0) {
        console.log('\n🔸 Issues Fixed:');
        issuesFound.forEach((issue, idx) => {
            console.log(`${idx+1}. ${issue.reason}`);
            console.log(`   NAICS ${issue.naics} -> OLD: ${issue.oldNace} -> NEW: ${issue.newNace}`);
        });
    }
    
    console.log('\n✨ Crosswalk fixes completed!');
    return { fixCount, issuesFound };
    
    } catch (error) {
        console.error('Error fixing crosswalk:', error);
        throw error;
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    fixCrosswalk();
}

export { fixCrosswalk };