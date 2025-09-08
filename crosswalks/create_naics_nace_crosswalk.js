import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const correspondenceTablesDir = __dirname; // Files are now in the same directory

function parseCSVLine(line, delimiter = ',') {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"' && (i === 0 || line[i-1] === delimiter)) {
            inQuotes = true;
        } else if (char === '"' && inQuotes && (i === line.length - 1 || line[i+1] === delimiter)) {
            inQuotes = false;
        } else if (char === delimiter && !inQuotes) {
            result.push(current.trim().replace(/^"(.*)"$/, '$1'));
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim().replace(/^"(.*)"$/, '$1'));
    return result;
}

function loadNaicsToIsic() {
    console.log('Loading NAICS 2022 to ISIC Rev. 4 mapping...');
    const filePath = path.join(correspondenceTablesDir, '2022_NAICS_to_ISIC_Rev_4.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    const naicsToIsic = {};
    data.forEach(row => {
        // Handle the malformed column names with line breaks
        const naicsCode = row['2022\r\nNAICS\r\nUS  '] || row['2022 NAICS US'];
        const isicCode = row['ISIC 4.0'];
        const naicsTitle = row['2022 NAICS US TITLE'];
        const isicTitle = row['ISIC Revision 4.0 Title'];
        const partOfNaics = row['Part of NAICS US'];
        const partOfIsic = row['Part of ISIC'];
        const notes = row['Notes:  link content based on NAICS definition, entire NAICS industry if blank'] || row['Notes'];
        
        // Skip invalid entries (code = 0 means multiple industries)
        if (naicsCode && isicCode && naicsCode !== 0 && isicCode !== 0) {
            const naicsCodeStr = naicsCode.toString();
            if (!naicsToIsic[naicsCodeStr]) {
                naicsToIsic[naicsCodeStr] = [];
            }
            naicsToIsic[naicsCodeStr].push({
                isicCode: isicCode.toString(),
                naicsTitle: naicsTitle || '',
                isicTitle: isicTitle || '',
                partOfNaics: partOfNaics === '*',
                partOfIsic: partOfIsic === '*',
                notes: notes || ''
            });
        }
    });
    
    console.log(`Loaded ${Object.keys(naicsToIsic).length} NAICS codes with mappings to ISIC`);
    return naicsToIsic;
}

function loadIsicToNace() {
    console.log('Loading ISIC Rev. 4 to NACE Rev. 2 mapping...');
    const filePath = path.join(correspondenceTablesDir, 'ISIC_4_to_NACE_Rev.2.txt');
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    const isicToNace = {};
    const hierarchyMap = {}; // Track ISIC hierarchy for intelligent fallback
    
    for (let i = 1; i < lines.length; i++) { // Skip header
        const fields = parseCSVLine(lines[i]);
        if (fields.length >= 4) {
            const isicCode = fields[0];
            const naceCode = fields[2];
            const isicPart = parseInt(fields[1]) === 1;
            const nacePart = parseInt(fields[3]) === 1;
            
            if (isicCode && naceCode) {
                if (!isicToNace[isicCode]) {
                    isicToNace[isicCode] = [];
                }
                isicToNace[isicCode].push({
                    naceCode: naceCode,
                    isicPart: isicPart,
                    nacePart: nacePart
                });
                
                // Build hierarchy mapping for fallback logic
                const codeLength = isicCode.length;
                if (codeLength === 4) {
                    const parent3 = isicCode.substring(0, 3);
                    const parent2 = isicCode.substring(0, 2);
                    const parent1 = isicCode.substring(0, 1);
                    
                    if (!hierarchyMap[parent3]) hierarchyMap[parent3] = [];
                    if (!hierarchyMap[parent2]) hierarchyMap[parent2] = [];
                    if (!hierarchyMap[parent1]) hierarchyMap[parent1] = [];
                    
                    hierarchyMap[parent3].push(isicCode);
                    hierarchyMap[parent2].push(isicCode);
                    hierarchyMap[parent1].push(isicCode);
                }
            }
        }
    }
    
    console.log(`Loaded ${Object.keys(isicToNace).length} ISIC codes with mappings to NACE Rev. 2`);
    console.log(`Built hierarchy map with ${Object.keys(hierarchyMap).length} parent codes`);
    
    // Store hierarchy map for use in crosswalk generation
    isicToNace._hierarchyMap = hierarchyMap;
    
    return isicToNace;
}

function loadNaceToNace21() {
    console.log('Loading NACE Rev. 2 to NACE Rev. 2.1 mapping...');
    const filePath = path.join(correspondenceTablesDir, 'NACE_Rev.2_to_NACE_Rev.2.1.xlsx');
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Get raw data to find header row
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    let headerRowIndex = -1;
    
    // Find the row with the actual headers
    for (let i = 0; i < rawData.length; i++) {
        if (rawData[i].includes('ID') && rawData[i].includes('NACE Rev. 2 Code')) {
            headerRowIndex = i;
            break;
        }
    }
    
    if (headerRowIndex === -1) {
        throw new Error('Could not find header row in NACE Rev. 2 to NACE Rev. 2.1 file');
    }
    
    // Parse data starting from the header row
    const data = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex });
    
    const naceToNace21 = {};
    data.forEach(row => {
        const nace2Code = row['NACE Rev. 2 Code'];
        const nace21Code = row['NACE Rev. 2.1 Code'];
        if (nace2Code && nace21Code) {
            if (!naceToNace21[nace2Code]) {
                naceToNace21[nace2Code] = [];
            }
            naceToNace21[nace2Code].push({
                nace21Code: nace21Code,
                nace2Title: row['NACE Rev. 2 Heading'] || '',
                nace21Title: row['NACE Rev. 2.1 Heading'] || '',
                mappingType: row['Type of mapping from the NACE Rev. 2 code(s) to NACE Rev. 2.1 code(s)'] || row['Type of mapping'] || '',
                correspondenceType: row['Type of correspondence'] || '',
                commonContent: row['Common content identified for the NACE Rev. 2 class and the NACE Rev. 2.1 class'] || row['Common content identified'] || ''
            });
        }
    });
    
    console.log(`Loaded ${Object.keys(naceToNace21).length} NACE Rev. 2 codes with mappings to NACE Rev. 2.1`);
    return naceToNace21;
}

function createNaicsToNaceCrosswalk(naicsToIsic, isicToNace, naceToNace21) {
    console.log('Creating NAICS 2022 to NACE Rev. 2.1 crosswalk...');
    const crosswalk = [];
    const hierarchyMap = isicToNace._hierarchyMap || {};
    let mappingsFound = 0;
    let mappingsWithFallback = 0;
    let mappingsWithoutNace = 0;
    
    // Function to find NACE mapping using intelligent fallback
    function findNaceMapping(isicCode, isicMapping) {
        // Try exact match first
        if (isicToNace[isicCode]) {
            return { mappings: isicToNace[isicCode], method: 'exact' };
        }
        
        // Try adding leading zero for 3-digit codes (e.g., "111" -> "0111")
        if (isicCode.length === 3) {
            const paddedCode = '0' + isicCode;
            if (isicToNace[paddedCode]) {
                return { mappings: isicToNace[paddedCode], method: 'zero-padded' };
            }
        }
        
        // Try finding child codes in hierarchy
        const childCodes = hierarchyMap[isicCode] || [];
        if (childCodes.length > 0) {
            const childMappings = [];
            childCodes.forEach(childCode => {
                if (isicToNace[childCode]) {
                    childMappings.push(...isicToNace[childCode].map(mapping => ({
                        ...mapping,
                        fromChild: childCode
                    })));
                }
            });
            if (childMappings.length > 0) {
                return { mappings: childMappings, method: 'hierarchy-expansion' };
            }
        }
        
        // Try finding parent code
        if (isicCode.length > 1) {
            for (let len = isicCode.length - 1; len >= 1; len--) {
                const parentCode = isicCode.substring(0, len);
                if (isicToNace[parentCode]) {
                    return { 
                        mappings: isicToNace[parentCode].map(mapping => ({
                            ...mapping,
                            fromParent: parentCode
                        })), 
                        method: 'parent-fallback' 
                    };
                }
            }
        }
        
        return { mappings: [], method: 'no-mapping' };
    }
    
    Object.keys(naicsToIsic).forEach(naicsCode => {
        const isicMappings = naicsToIsic[naicsCode];
        
        isicMappings.forEach(isicMapping => {
            const isicCode = isicMapping.isicCode;
            const naceResult = findNaceMapping(isicCode, isicMapping);
            const naceMappings = naceResult.mappings;
            
            if (naceMappings.length > 0) {
                mappingsFound++;
                if (naceResult.method !== 'exact') {
                    mappingsWithFallback++;
                }
                
                naceMappings.forEach(naceMapping => {
                    const naceCode = naceMapping.naceCode;
                    const nace21Mappings = naceToNace21[naceCode] || [];
                    
                    if (nace21Mappings.length === 0) {
                        // Direct mapping to NACE Rev. 2 if no NACE 2.1 mapping exists
                        crosswalk.push({
                            naics2022Code: naicsCode,
                            naics2022Title: isicMapping.naicsTitle,
                            isicRev4Code: isicCode,
                            isicRev4Title: isicMapping.isicTitle,
                            naceRev2Code: naceCode,
                            naceRev2Title: '',
                            naceRev21Code: naceCode, // Same as Rev. 2 if no update
                            naceRev21Title: '',
                            mappingPath: naceResult.method === 'exact' ? 'NAICS→ISIC→NACE2' : `NAICS→ISIC→NACE2 (${naceResult.method})`,
                            mappingNotes: `${isicMapping.notes}${naceResult.method !== 'exact' ? ` | Mapping via ${naceResult.method}` : ''}${naceMapping.fromChild ? ` from child ${naceMapping.fromChild}` : ''}${naceMapping.fromParent ? ` from parent ${naceMapping.fromParent}` : ''}`,
                            partialMappings: {
                                naicsPartial: isicMapping.partOfNaics,
                                isicPartial: isicMapping.partOfIsic || naceResult.method !== 'exact',
                                nacePartial: naceMapping.nacePart
                            },
                            mappingQuality: naceResult.method === 'exact' ? 'direct' : 'inferred'
                        });
                    } else {
                        nace21Mappings.forEach(nace21Mapping => {
                            crosswalk.push({
                                naics2022Code: naicsCode,
                                naics2022Title: isicMapping.naicsTitle,
                                isicRev4Code: isicCode,
                                isicRev4Title: isicMapping.isicTitle,
                                naceRev2Code: naceCode,
                                naceRev2Title: nace21Mapping.nace2Title,
                                naceRev21Code: nace21Mapping.nace21Code,
                                naceRev21Title: nace21Mapping.nace21Title,
                                mappingPath: naceResult.method === 'exact' ? 'NAICS→ISIC→NACE2→NACE2.1' : `NAICS→ISIC→NACE2→NACE2.1 (${naceResult.method})`,
                                mappingNotes: `${isicMapping.notes}${naceResult.method !== 'exact' ? ` | Mapping via ${naceResult.method}` : ''}${naceMapping.fromChild ? ` from child ${naceMapping.fromChild}` : ''}${naceMapping.fromParent ? ` from parent ${naceMapping.fromParent}` : ''}`,
                                partialMappings: {
                                    naicsPartial: isicMapping.partOfNaics,
                                    isicPartial: isicMapping.partOfIsic || naceResult.method !== 'exact',
                                    nacePartial: naceMapping.nacePart
                                },
                                naceUpdateInfo: {
                                    mappingType: nace21Mapping.mappingType,
                                    correspondenceType: nace21Mapping.correspondenceType,
                                    commonContent: nace21Mapping.commonContent
                                },
                                mappingQuality: naceResult.method === 'exact' ? 'direct' : 'inferred'
                            });
                        });
                    }
                });
            } else {
                // Handle ISIC codes without NACE mappings (after all fallback attempts)
                mappingsWithoutNace++;
                crosswalk.push({
                    naics2022Code: naicsCode,
                    naics2022Title: isicMapping.naicsTitle,
                    isicRev4Code: isicCode,
                    isicRev4Title: isicMapping.isicTitle,
                    naceRev2Code: '',
                    naceRev2Title: '',
                    naceRev21Code: '',
                    naceRev21Title: '',
                    mappingPath: 'NAICS→ISIC (no NACE mapping)',
                    mappingNotes: `${isicMapping.notes} | No NACE mapping found for ISIC ${isicCode} (tried all fallback methods)`,
                    partialMappings: {
                        naicsPartial: isicMapping.partOfNaics,
                        isicPartial: isicMapping.partOfIsic,
                        nacePartial: false
                    },
                    mappingQuality: 'failed'
                });
            }
        });
    });
    
    console.log(`Created crosswalk with ${crosswalk.length} mappings`);
    console.log(`Mappings with NACE codes: ${mappingsFound}`);
    console.log(`Mappings using fallback methods: ${mappingsWithFallback}`);
    console.log(`Mappings without NACE codes: ${mappingsWithoutNace}`);
    return crosswalk;
}

function saveToCSV(crosswalk, outputPath) {
    console.log(`Saving crosswalk to ${outputPath}...`);
    const headers = [
        'NAICS_2022_Code',
        'NAICS_2022_Title',
        'ISIC_Rev4_Code',
        'ISIC_Rev4_Title',
        'NACE_Rev2_Code',
        'NACE_Rev2_Title',
        'NACE_Rev21_Code',
        'NACE_Rev21_Title',
        'Mapping_Path',
        'Mapping_Notes',
        'NAICS_Partial',
        'ISIC_Partial',
        'NACE_Partial',
        'NACE_Mapping_Type',
        'NACE_Correspondence_Type',
        'NACE_Common_Content',
        'Mapping_Quality'
    ];
    
    let csvContent = headers.join(',') + '\n';
    
    crosswalk.forEach(row => {
        const csvRow = [
            `"${row.naics2022Code}"`,
            `"${(row.naics2022Title || '').replace(/"/g, '""')}"`,
            `"${row.isicRev4Code}"`,
            `"${(row.isicRev4Title || '').replace(/"/g, '""')}"`,
            `"${row.naceRev2Code}"`,
            `"${(row.naceRev2Title || '').replace(/"/g, '""')}"`,
            `"${row.naceRev21Code}"`,
            `"${(row.naceRev21Title || '').replace(/"/g, '""')}"`,
            `"${row.mappingPath}"`,
            `"${(row.mappingNotes || '').replace(/"/g, '""')}"`,
            row.partialMappings?.naicsPartial || false,
            row.partialMappings?.isicPartial || false,
            row.partialMappings?.nacePartial || false,
            `"${(row.naceUpdateInfo?.mappingType || '').replace(/"/g, '""')}"`,
            `"${(row.naceUpdateInfo?.correspondenceType || '').replace(/"/g, '""')}"`,
            `"${(row.naceUpdateInfo?.commonContent || '').replace(/"/g, '""')}"`,
            `"${row.mappingQuality || 'unknown'}"`
        ];
        csvContent += csvRow.join(',') + '\n';
    });
    
    fs.writeFileSync(outputPath, csvContent, 'utf-8');
    console.log('Crosswalk saved successfully!');
}

function saveToJSON(crosswalk, outputPath) {
    console.log(`Saving crosswalk to ${outputPath}...`);
    const jsonData = {
        metadata: {
            created: new Date().toISOString(),
            description: 'Crosswalk mapping from NAICS 2022 to NACE Rev. 2.1',
            mappingPath: 'NAICS 2022 → ISIC Rev. 4 → NACE Rev. 2 → NACE Rev. 2.1',
            totalMappings: crosswalk.length,
            sources: [
                '2022_NAICS_to_ISIC_Rev_4.xlsx',
                'ISIC_4_to_NACE_Rev.2.txt',
                'NACE_Rev.2_to_NACE_Rev.2.1.xlsx'
            ]
        },
        crosswalk: crosswalk
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
    console.log('JSON crosswalk saved successfully!');
}

function generateStatistics(crosswalk) {
    console.log('\n--- CROSSWALK STATISTICS ---');
    
    const uniqueNaicsCodes = new Set(crosswalk.map(row => row.naics2022Code)).size;
    const uniqueNace21Codes = new Set(crosswalk.filter(row => row.naceRev21Code).map(row => row.naceRev21Code)).size;
    const mappingsWithNace = crosswalk.filter(row => row.naceRev21Code).length;
    const mappingsWithoutNace = crosswalk.length - mappingsWithNace;
    const partialMappings = crosswalk.filter(row => 
        row.partialMappings?.naicsPartial || 
        row.partialMappings?.isicPartial || 
        row.partialMappings?.nacePartial
    ).length;
    
    console.log(`Total mappings: ${crosswalk.length}`);
    console.log(`Unique NAICS 2022 codes: ${uniqueNaicsCodes}`);
    console.log(`Unique NACE Rev. 2.1 codes: ${uniqueNace21Codes}`);
    console.log(`Mappings with NACE codes: ${mappingsWithNace}`);
    console.log(`Mappings without NACE codes: ${mappingsWithoutNace}`);
    console.log(`Partial mappings: ${partialMappings}`);
    console.log(`Coverage rate: ${((mappingsWithNace / crosswalk.length) * 100).toFixed(1)}%`);
    
    // Mapping quality breakdown
    const qualityBreakdown = {};
    crosswalk.forEach(row => {
        const quality = row.mappingQuality || 'unknown';
        qualityBreakdown[quality] = (qualityBreakdown[quality] || 0) + 1;
    });
    
    console.log('\nMapping quality distribution:');
    Object.entries(qualityBreakdown).forEach(([quality, count]) => {
        const percentage = ((count / crosswalk.length) * 100).toFixed(1);
        console.log(`  ${quality}: ${count} (${percentage}%)`);
    });
    
    const mappingPaths = {};
    crosswalk.forEach(row => {
        mappingPaths[row.mappingPath] = (mappingPaths[row.mappingPath] || 0) + 1;
    });
    
    console.log('\nMapping paths distribution:');
    Object.entries(mappingPaths).forEach(([path, count]) => {
        const percentage = ((count / crosswalk.length) * 100).toFixed(1);
        console.log(`  ${path}: ${count} (${percentage}%)`);
    });
    
    // Identify most common fallback methods
    const fallbackMethods = crosswalk.filter(row => 
        row.mappingQuality === 'inferred'
    ).map(row => {
        const match = row.mappingPath.match(/\(([^)]+)\)/);
        return match ? match[1] : 'unknown';
    });
    
    if (fallbackMethods.length > 0) {
        const fallbackCount = {};
        fallbackMethods.forEach(method => {
            fallbackCount[method] = (fallbackCount[method] || 0) + 1;
        });
        
        console.log('\nFallback methods used:');
        Object.entries(fallbackCount).forEach(([method, count]) => {
            console.log(`  ${method}: ${count}`);
        });
    }
}

async function main() {
    try {
        console.log('Starting NAICS 2022 to NACE Rev. 2.1 crosswalk creation...\n');
        
        // Load all correspondence tables
        const naicsToIsic = loadNaicsToIsic();
        const isicToNace = loadIsicToNace();
        const naceToNace21 = loadNaceToNace21();
        
        // Create the crosswalk
        const crosswalk = createNaicsToNaceCrosswalk(naicsToIsic, isicToNace, naceToNace21);
        
        // Generate statistics
        generateStatistics(crosswalk);
        
        // Save results in current directory
        const csvOutputPath = path.join(__dirname, 'NAICS_2022_to_NACE_Rev21_crosswalk.csv');
        const jsonOutputPath = path.join(__dirname, 'NAICS_2022_to_NACE_Rev21_crosswalk.json');
        
        saveToCSV(crosswalk, csvOutputPath);
        saveToJSON(crosswalk, jsonOutputPath);
        
        console.log('\n--- CROSSWALK CREATION COMPLETED ---');
        console.log(`Output files created in: ${__dirname}`);
        console.log(`CSV: NAICS_2022_to_NACE_Rev21_crosswalk.csv`);
        console.log(`JSON: NAICS_2022_to_NACE_Rev21_crosswalk.json`);
        
    } catch (error) {
        console.error('Error creating crosswalk:', error);
        process.exit(1);
    }
}

// Run the main function
main();