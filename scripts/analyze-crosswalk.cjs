const fs = require('fs');
const path = require('path');

function analyzeCrosswalkSpecificity() {
    const crosswalkPath = path.join(__dirname, '../crosswalks/NAICS_2022_to_NACE_Rev21_crosswalk.json');
    const rawData = fs.readFileSync(crosswalkPath, 'utf8');
    const data = JSON.parse(rawData);
    
    const stats = { 
        sections: 0, 
        divisions: 0, 
        groups: 0, 
        classes: 0, 
        total: 0,
        examples: {
            sections: [],
            divisions: [],
            groups: [],
            classes: []
        }
    };
    
    data.crosswalk.forEach(entry => {
        if (!entry.naceRev21Code) return;
        
        stats.total++;
        const code = entry.naceRev21Code;
        
        if (/^[A-Z]$/.test(code)) {
            stats.sections++;
            if (stats.examples.sections.length < 3) {
                stats.examples.sections.push({
                    naics: entry.naics2022Code,
                    nace: code,
                    title: entry.naceRev21Title
                });
            }
        } else if (/^[0-9]{1,2}$/.test(code)) {
            stats.divisions++;
            if (stats.examples.divisions.length < 3) {
                stats.examples.divisions.push({
                    naics: entry.naics2022Code,
                    nace: code,
                    title: entry.naceRev21Title
                });
            }
        } else if (/^[0-9]{1,2}\.[0-9]{1}$/.test(code)) {
            stats.groups++;
            if (stats.examples.groups.length < 3) {
                stats.examples.groups.push({
                    naics: entry.naics2022Code,
                    nace: code,
                    title: entry.naceRev21Title
                });
            }
        } else if (/^[0-9]{1,2}\.[0-9]{2}$/.test(code)) {
            stats.classes++;
            if (stats.examples.classes.length < 3) {
                stats.examples.classes.push({
                    naics: entry.naics2022Code,
                    nace: code,
                    title: entry.naceRev21Title
                });
            }
        }
    });
    
    console.log('=== CORRECTED CROSSWALK CODE DISTRIBUTION ===');
    console.log(`Total mappings: ${stats.total}`);
    console.log(`  Class codes (4-digit XX.XX): ${stats.classes} (${(stats.classes/stats.total*100).toFixed(1)}%)`);
    console.log(`  Group codes (3-digit XX.X): ${stats.groups} (${(stats.groups/stats.total*100).toFixed(1)}%)`);
    console.log(`  Division codes (2-digit XX): ${stats.divisions} (${(stats.divisions/stats.total*100).toFixed(1)}%)`);
    console.log(`  Section codes (1-digit X): ${stats.sections} (${(stats.sections/stats.total*100).toFixed(1)}%)`);
    
    console.log('\n=== VALIDATION RESULTS ===');
    const classPercentage = (stats.classes / stats.total) * 100;
    const specificPercentage = ((stats.classes + stats.groups) / stats.total) * 100;
    
    if (stats.divisions === 0 && stats.sections === 0) {
        console.log('✅ EXCELLENT: No category codes (divisions/sections) found!');
    } else {
        console.log(`❌ ISSUE: ${stats.divisions + stats.sections} category codes still present`);
        
        if (stats.divisions > 0) {
            console.log(`\nDivision code examples (${stats.divisions} total):`);
            stats.examples.divisions.forEach(ex => 
                console.log(`  NAICS ${ex.naics} -> NACE ${ex.nace} (${ex.title})`)
            );
        }
        
        if (stats.sections > 0) {
            console.log(`\nSection code examples (${stats.sections} total):`);
            stats.examples.sections.forEach(ex => 
                console.log(`  NAICS ${ex.naics} -> NACE ${ex.nace} (${ex.title})`)
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
    
    console.log('\n=== CLASS CODE EXAMPLES ===');
    stats.examples.classes.forEach(ex => 
        console.log(`  NAICS ${ex.naics} -> NACE ${ex.nace} (${ex.title})`)
    );
    
    return stats;
}

if (require.main === module) {
    analyzeCrosswalkSpecificity();
}

module.exports = { analyzeCrosswalkSpecificity };