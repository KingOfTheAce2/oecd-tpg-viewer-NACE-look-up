import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function analyzeCrosswalkFromCSV() {
    const csvPath = path.join(__dirname, '../crosswalks/NAICS_2022_to_NACE_Rev21_crosswalk.csv');
    
    if (!fs.existsSync(csvPath)) {
        console.error('CSV file not found:', csvPath);
        return;
    }

    const csvData = fs.readFileSync(csvPath, 'utf8');
    const lines = csvData.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
    
    console.log('CSV Headers:', headers);
    
    const naceCodeIndex = headers.findIndex(h => h === 'NACE_Rev21_Code');
    const naicsCodeIndex = headers.findIndex(h => h === 'NAICS_2022_Code');
    const naceTitleIndex = headers.findIndex(h => h === 'NACE_Rev21_Title');
    const naicsTitleIndex = headers.findIndex(h => h === 'NAICS_2022_Title');
    
    if (naceCodeIndex === -1 || naicsCodeIndex === -1) {
        console.error('Required columns not found');
        console.log('Available columns:', headers);
        return;
    }

    const stats = { 
        sections: 0, 
        divisions: 0, 
        groups: 0, 
        classes: 0, 
        total: 0,
        weird: 0,
        examples: {
            sections: [],
            divisions: [],
            groups: [],
            classes: [],
            weird: []
        }
    };
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        const columns = line.split(',').map(col => col.replace(/"/g, '').trim());
        
        if (columns.length <= Math.max(naceCodeIndex, naicsCodeIndex)) continue;
        
        const naceCode = columns[naceCodeIndex];
        const naicsCode = columns[naicsCodeIndex];
        const naceTitle = columns[naceTitleIndex] || '';
        const naicsTitle = columns[naicsTitleIndex] || '';
        
        if (!naceCode || naceCode === 'NACE_Rev21_Code') continue;
        
        stats.total++;
        
        // Check for weird crossovers (agriculture to manufacturing, etc.)
        const isWeirdCrossover = checkWeirdCrossover(naicsCode, naceCode, naicsTitle, naceTitle);
        if (isWeirdCrossover) {
            stats.weird++;
            if (stats.examples.weird.length < 10) {
                stats.examples.weird.push({
                    naics: naicsCode,
                    nace: naceCode,
                    naicsTitle: naicsTitle,
                    naceTitle: naceTitle
                });
            }
        }
        
        // Classify NACE code level
        if (/^[A-Z]$/.test(naceCode)) {
            stats.sections++;
            if (stats.examples.sections.length < 3) {
                stats.examples.sections.push({
                    naics: naicsCode,
                    nace: naceCode,
                    naceTitle: naceTitle
                });
            }
        } else if (/^[0-9]{1,2}$/.test(naceCode)) {
            stats.divisions++;
            if (stats.examples.divisions.length < 3) {
                stats.examples.divisions.push({
                    naics: naicsCode,
                    nace: naceCode,
                    naceTitle: naceTitle
                });
            }
        } else if (/^[0-9]{1,2}\.[0-9]{1}$/.test(naceCode)) {
            stats.groups++;
            if (stats.examples.groups.length < 3) {
                stats.examples.groups.push({
                    naics: naicsCode,
                    nace: naceCode,
                    naceTitle: naceTitle
                });
            }
        } else if (/^[0-9]{1,2}\.[0-9]{2}$/.test(naceCode)) {
            stats.classes++;
            if (stats.examples.classes.length < 3) {
                stats.examples.classes.push({
                    naics: naicsCode,
                    nace: naceCode,
                    naceTitle: naceTitle
                });
            }
        }
    }
    
    console.log('=== NAICS-NACE CROSSWALK ANALYSIS ===');
    console.log(`Total mappings: ${stats.total}`);
    console.log(`  Class codes (4-digit XX.XX): ${stats.classes} (${(stats.classes/stats.total*100).toFixed(1)}%)`);
    console.log(`  Group codes (3-digit XX.X): ${stats.groups} (${(stats.groups/stats.total*100).toFixed(1)}%)`);
    console.log(`  Division codes (2-digit XX): ${stats.divisions} (${(stats.divisions/stats.total*100).toFixed(1)}%)`);
    console.log(`  Section codes (1-digit X): ${stats.sections} (${(stats.sections/stats.total*100).toFixed(1)}%)`);
    console.log(`  Weird crossovers: ${stats.weird} (${(stats.weird/stats.total*100).toFixed(1)}%)`);
    
    console.log('\n=== VALIDATION RESULTS ===');
    const classPercentage = (stats.classes / stats.total) * 100;
    const specificPercentage = ((stats.classes + stats.groups) / stats.total) * 100;
    
    if (stats.divisions === 0 && stats.sections === 0) {
        console.log('✅ EXCELLENT: No category codes (divisions/sections) found!');
    } else {
        console.log(`❌ ISSUE: ${stats.divisions + stats.sections} category codes still present`);
        
        if (stats.divisions > 0) {
            console.log(`\n🔸 Division code examples (${stats.divisions} total):`);
            stats.examples.divisions.forEach(ex => 
                console.log(`  NAICS ${ex.naics} -> NACE ${ex.nace} (${ex.naceTitle})`)
            );
        }
        
        if (stats.sections > 0) {
            console.log(`\n🔸 Section code examples (${stats.sections} total):`);
            stats.examples.sections.forEach(ex => 
                console.log(`  NAICS ${ex.naics} -> NACE ${ex.nace} (${ex.naceTitle})`)
            );
        }
    }
    
    if (classPercentage >= 90) {
        console.log(`✅ GOOD: ${classPercentage.toFixed(1)}% are specific 4-digit class codes`);
    } else {
        console.log(`⚠️  WARNING: Only ${classPercentage.toFixed(1)}% are 4-digit class codes (target: 90%+)`);
    }
    
    if (specificPercentage >= 95) {
        console.log(`✅ ACCEPTABLE: ${specificPercentage.toFixed(1)}% are specific codes (class + group)`);
    } else {
        console.log(`❌ ISSUE: Only ${specificPercentage.toFixed(1)}% are specific codes (target: 95%+)`);
    }

    if (stats.weird > 0) {
        console.log(`\n🚨 WEIRD CROSSOVERS DETECTED (${stats.weird} total):`);
        stats.examples.weird.forEach(ex => 
            console.log(`  NAICS ${ex.naics} (${ex.naicsTitle}) -> NACE ${ex.nace} (${ex.naceTitle})`)
        );
    }
    
    console.log('\n=== CLASS CODE EXAMPLES ===');
    stats.examples.classes.forEach(ex => 
        console.log(`  NAICS ${ex.naics} -> NACE ${ex.nace} (${ex.naceTitle})`)
    );
    
    return stats;
}

function checkWeirdCrossover(naicsCode, naceCode, naicsTitle, naceTitle) {
    // Check for obvious sector mismatches
    const naicsPrefix = naicsCode.substring(0, 2);
    const nacePrefix = naceCode.substring(0, 2);
    
    // NAICS sector definitions
    const naicsAgriculture = ['11']; // Agriculture, Forestry, Fishing
    const naicsManufacturing = ['31', '32', '33']; // Manufacturing
    const naicsConstruction = ['23']; // Construction
    const naicsRetail = ['44', '45']; // Retail Trade
    const naicsServices = ['51', '52', '53', '54', '55', '56', '61', '62', '71', '72', '81', '92'];
    
    // NACE sector definitions  
    const naceAgriculture = ['01', '02', '03']; // Agriculture, forestry and fishing
    const naceManufacturing = ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33']; // Manufacturing
    const naceConstruction = ['41', '42', '43']; // Construction
    const naceServices = ['45', '46', '47', '49', '50', '51', '52', '53', '55', '56', '58', '59', '60', '61', '62', '63', '64', '65', '66', '68', '69', '70', '71', '72', '73', '74', '75', '77', '78', '79', '80', '81', '82', '84', '85', '86', '87', '88', '90', '91', '92', '93', '94', '95', '96', '97', '98', '99'];
    
    // Detect major sector crossovers
    if (naicsAgriculture.includes(naicsPrefix) && naceManufacturing.includes(nacePrefix)) {
        return true; // Agriculture to Manufacturing
    }
    
    if (naicsManufacturing.includes(naicsPrefix) && naceAgriculture.includes(nacePrefix)) {
        return true; // Manufacturing to Agriculture  
    }
    
    if (naicsConstruction.includes(naicsPrefix) && naceAgriculture.includes(nacePrefix)) {
        return true; // Construction to Agriculture
    }
    
    // Check for specific weird cases from the data
    if (naicsCode === '111336' && naceCode === '12') {
        return true; // "Fruit and Tree Nut Combination Farming" -> "Manufacture of tobacco products"
    }
    
    // Check title-based mismatches
    if (naicsTitle.toLowerCase().includes('farming') && naceTitle.toLowerCase().includes('manufacture')) {
        return true;
    }
    
    if (naicsTitle.toLowerCase().includes('agriculture') && naceTitle.toLowerCase().includes('tobacco')) {
        return true;
    }
    
    return false;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    analyzeCrosswalkFromCSV();
}

export { analyzeCrosswalkFromCSV };