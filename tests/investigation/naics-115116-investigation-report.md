# CRITICAL INVESTIGATION: NAICS 115116 "Farm Management Services" Mapping Error

**Investigation Date:** 2025-09-08  
**Severity:** CRITICAL - Fundamental sectoral misclassification  
**Status:** ERROR CONFIRMED - Agriculture Support → Wood Manufacturing  

## Executive Summary

A critical mapping error has been identified where NAICS 115116 "Farm Management Services" (agricultural support services) is incorrectly mapped to NACE 16.1 "Sawmilling and planing of wood" (manufacturing/wood processing). This represents a fundamental sectoral misclassification that violates the basic economic classification principles.

## Investigation Findings

### 1. Current Incorrect Mappings

**NAICS 115116 "Farm Management Services" is erroneously mapped to:**

| NAICS Code | NAICS Title | ISIC Code | ISIC Title | NACE Rev 2 Code | NACE Rev 2 Title | NACE Rev 2.1 Code | NACE Rev 2.1 Title | Error Type |
|------------|-------------|-----------|------------|------------------|------------------|-------------------|-------------------|------------|
| 115116 | Farm Management Services | 161 | Support activities for crop production | 16.1 | Sawmilling and planing of wood | 16.1 | Sawmilling and planing of wood; processing and finishing of wood | Agriculture → Manufacturing |
| 115116 | Farm Management Services | 162 | Support activities for animal production | 16.2 | Manufacture of products of wood, cork, straw and plaiting materials | 15.2, 16.2 | Manufacture of footwear, Manufacture of products of wood, cork, straw and plaiting materials | Agriculture → Manufacturing |

### 2. Authoritative Definitions

#### NAICS 115116 "Farm Management Services" (US Census 2022)
- **Sector:** Agriculture, Forestry, Fishing and Hunting
- **Definition:** Establishments primarily engaged in providing farm management services on a contract or fee basis usually to citrus groves, orchards, or vineyards
- **Activities:** Provide management and may arrange or contract for the partial or the complete operations of the farm establishment(s) it manages
- **Key Function:** Comprehensive farm management services rather than just performing individual agricultural tasks

#### NACE 16.1 "Sawmilling and Planing of Wood" (Eurostat)
- **Sector:** Manufacturing (Section C)
- **Definition:** First processing stages of sawmilling and planing of wood
- **Activities:** 
  - Drying and machining of wood
  - Slicing, peeling or chipping logs
  - Manufacture of wooden railway sleepers and unassembled wooden flooring
  - Impregnation or chemical treatment of wood
  - Manufacture of wood wool, wood flour, chips or particles

### 3. Systematic Pattern of Agriculture → Manufacturing Misclassifications

**Multiple NAICS agriculture support codes are incorrectly mapped to manufacturing:**

| NAICS Code | NAICS Title | Correct Sector | Incorrect NACE Mapping | Correct Sector |
|------------|-------------|----------------|------------------------|----------------|
| 115112 | Soil Preparation, Planting, and Cultivating | Agriculture Support | 16.1 Sawmilling and planing of wood | Manufacturing |
| 115113 | Crop Harvesting, Primarily by Machine | Agriculture Support | 16.1 Sawmilling and planing of wood | Manufacturing |
| 115115 | Farm Labor Contractors and Crew Leaders | Agriculture Support | 16.1 Sawmilling and planing of wood | Manufacturing |
| 115116 | Farm Management Services | Agriculture Support | 16.1/16.2 Wood manufacturing | Manufacturing |
| 115210 | Support Activities for Animal Production | Agriculture Support | 16.2/15.2 Wood/Footwear manufacturing | Manufacturing |

**Correctly mapped codes for comparison:**
- 115111 Cotton Ginning → 01.63 Post-harvest crop activities ✓
- 115114 Postharvest Crop Activities → 01.63 Post-harvest crop activities ✓
- 115310 Support Activities for Forestry → 02.40 Support services to forestry ✓

### 4. Root Cause Analysis

#### ISIC Intermediate Mapping Chain Error

The error occurs in the mapping chain: **NAICS 2022 → ISIC Rev. 4 → NACE Rev. 2 → NACE Rev. 2.1**

**Problem identified:**
- ISIC 161 "Support activities for crop production" is CORRECTLY classified as agricultural support
- NACE Rev 2 should map to 01.61 "Support activities for crop production" (Agriculture)
- **ERROR:** ISIC 161 is incorrectly mapped to NACE 16.1 "Sawmilling and planing of wood" (Manufacturing)

**Evidence of mapping error:**
```
ISIC 161 → Support activities for crop production (AGRICULTURE)
↓ (INCORRECT MAPPING)
NACE 16.1 → Sawmilling and planing of wood (MANUFACTURING)
```

**Correct mapping should be:**
```
ISIC 161 → Support activities for crop production (AGRICULTURE)
↓ (CORRECT MAPPING)
NACE 01.61 → Support activities for crop production (AGRICULTURE)
```

### 5. Impact Assessment

#### Data Integrity Impact
- **Agriculture support services** (NAICS 115xxx) are being classified as **manufacturing activities**
- Cross-national economic comparisons are fundamentally flawed
- Transfer pricing analysis between agriculture and manufacturing sectors is corrupted
- Statistical analysis of agricultural support vs manufacturing is invalid

#### Economic Misrepresentation
- Farm management companies appear as wood processing manufacturers
- Agricultural GDP calculations may be understated
- Manufacturing GDP calculations may be overstated
- Policy analysis for agriculture support vs manufacturing incentives is incorrect

## Correct Mapping Requirements

### Target NACE Rev 2.1 Codes for Agriculture Support Services

| NAICS Code | Current Incorrect NACE | Correct NACE Rev 2.1 | Correct Title |
|------------|------------------------|---------------------|---------------|
| 115112 | 16.1 (Wood sawmilling) | 01.61 | Support activities for crop production |
| 115113 | 16.1 (Wood sawmilling) | 01.61 | Support activities for crop production |
| 115115 | 16.1 (Wood sawmilling) | 01.61 | Support activities for crop production |
| 115116 | 16.1/16.2 (Wood manufacturing) | 01.61 | Support activities for crop production |
| 115210 | 16.2/15.2 (Wood/Footwear) | 01.62 | Support activities for animal production |

### NACE Rev 2.1 Structure for Agriculture Support

**Section A: Agriculture, forestry and fishing**
- Division 01: Crop and animal production, hunting and related service activities
  - Group 01.6: Support activities to agriculture and post-harvest crop activities
    - **01.61: Support activities for crop production** ← CORRECT TARGET
    - **01.62: Support activities for animal production** ← CORRECT TARGET

## Remediation Actions Required

### Immediate Actions
1. **Update all crosswalk data files** with correct NACE mappings
2. **Fix ISIC → NACE correspondence table** to prevent future errors
3. **Validate corrections** across JSON and CSV formats
4. **Create regression tests** to prevent re-occurrence

### Files Requiring Updates
- `D:\GitHub\oecd-tpg-viewer-NACE-look-up\crosswalks\NAICS_2022_to_NACE_Rev21_crosswalk.json`
- `D:\GitHub\oecd-tpg-viewer-NACE-look-up\crosswalks\NAICS_2022_to_NACE_Rev21_crosswalk.csv`
- `D:\GitHub\oecd-tpg-viewer-NACE-look-up\docs\data\naics_nace_crosswalk.json`
- `D:\GitHub\oecd-tpg-viewer-NACE-look-up\public\data\naics_nace_crosswalk.json`

### Testing Requirements
1. **Unit tests** for agriculture support service classifications
2. **Integration tests** for ISIC → NACE mapping chain
3. **Validation tests** to ensure Agriculture Section A codes map to Agriculture, not Manufacturing Section C

## Conclusion

This investigation reveals a systematic error in the ISIC → NACE mapping that has resulted in multiple agriculture support services being misclassified as manufacturing activities. The error affects fundamental economic sector classification and requires immediate correction to ensure data integrity and accurate cross-national economic analysis.

**Priority:** IMMEDIATE CORRECTION REQUIRED
**Impact:** HIGH - Affects economic sector classification accuracy
**Scope:** Multiple NAICS agriculture support codes (115xxx series)

---

**Investigation conducted by:** Production Validation Agent  
**Methodology:** Authoritative source validation, systematic pattern analysis, mapping chain root cause analysis  
**Sources:** US Census Bureau NAICS 2022, Eurostat NACE Rev 2.1, ISIC Rev 4 correspondence tables