# NAICS 114210 Mapping Investigation Report

## Executive Summary

**Critical Data Integrity Issue Identified:** NAICS 114210 'Hunting and Trapping' is incorrectly mapped to NACE Rev. 2.1 manufacturing codes (17.1 and 17.2) instead of the correct agriculture/hunting code (01.70).

## Investigation Findings

### Current Incorrect Mapping
- **NAICS Code:** 114210
- **NAICS Title:** "Hunting and Trapping" 
- **ISIC Rev 4:** 170 "Hunting, trapping and related service activities" ✅ CORRECT
- **Current NACE Mapping:** 17.1 "Manufacture of pulp, paper and paperboard" ❌ WRONG
- **Current NACE Mapping:** 17.2 "Manufacture of articles of paper and paperboard" ❌ WRONG

### Correct Mapping Should Be
- **NAICS Code:** 114210
- **NAICS Title:** "Hunting and Trapping"
- **ISIC Rev 4:** 170 "Hunting, trapping and related service activities" ✅ CORRECT
- **Correct NACE Mapping:** 01.70 "Hunting, trapping and related service activities" ✅ CORRECT

## Authoritative Source Validation

### NAICS 114210 Definition (US Census 2022)
This industry comprises establishments primarily engaged in one or more of the following: 
1. Commercial hunting and trapping
2. Operating commercial game preserves, such as game retreats
3. Operating hunting preserves

**Exclusions:**
- Operating nature preserves → Industry 712190
- Farm raising rabbits and other fur-bearing animals → Industry 112930
- Operating hunting camps with accommodation → Industry 721214
- Providing hunting guide services without accommodation → Industry 713990
- Providing bird and rodent control services → Industry 561710

### NACE Rev 2.1 Code 01.70 Definition (Eurostat)
**"Hunting, trapping and related service activities"**

**Includes:**
- Hunting and trapping on a commercial basis
- Taking of animals (dead or alive) for food, fur, skin, or for use in research, in zoos or as pets
- Production of fur skins, reptile or bird skins from hunting or trapping activities
- Land-based catching of sea mammals such as walrus and seal

**Excludes:**
- Production of fur skins from ranching operations → group 01.49
- Raising of game animals on ranching operations → 01.4
- Catching of whales → 03.11
- Production of hides and skins from slaughterhouses → 10.11
- Hunting for sport or recreation → 93.19
- Service activities to promote hunting and trapping → 94.99

### NACE Rev 2.1 Code 17.1 Definition (Incorrect Current Mapping)
**"Manufacture of pulp, paper and paperboard"**

This is part of Section C (Manufacturing) and specifically relates to:
- The manufacture of pulp, paper and paperboard through mechanical and chemical processes
- Capital-intensive manufacturing activity in the paper industry

## Root Cause Analysis

The mapping correctly identifies:
1. NAICS 114210 → ISIC 170 (correct conceptual mapping)
2. ISIC 170 should logically map to NACE 01.70 (both cover hunting/trapping activities)

However, the system incorrectly maps ISIC 170 to NACE 17.1 and 17.2, which are manufacturing codes in a completely different economic sector.

This appears to be a systematic error where the numeric similarity between:
- ISIC 170 (Hunting, trapping)
- NACE 17.x (Paper manufacturing)

Led to an incorrect algorithmic or manual mapping decision.

## Impact Assessment

### Data Quality Impact
- **Severity:** HIGH - Fundamental misclassification across economic sectors
- **Scope:** 2 incorrect mappings for 1 NAICS code
- **Economic Classification Impact:** Agriculture/Forestry/Fishing → Manufacturing sector misclassification

### Business Impact
- Transfer pricing analysis using this data would incorrectly benchmark hunting/trapping companies against paper manufacturers
- Economic research comparing NAICS and NACE classifications would be fundamentally flawed
- Regulatory compliance requiring accurate industry classification would be compromised

## Recommended Actions

### Immediate Corrections Required
1. **CSV File Update:** Change NACE mappings from 17.1/17.2 to 01.70
2. **JSON File Updates:** Correct all JSON crosswalk files
3. **Validation Testing:** Create unit tests to prevent regression
4. **Documentation Update:** Update any mapping methodology documentation

### Quality Assurance Measures
1. **Pattern Analysis:** Scan for similar numeric-based mis-mappings
2. **Conceptual Validation:** Ensure sector alignment between classifications
3. **Automated Testing:** Implement tests for cross-sector mapping violations

## Files Requiring Updates
- `crosswalks/NAICS_2022_to_NACE_Rev21_crosswalk.csv` (lines 263-264)
- `crosswalks/NAICS_2022_to_NACE_Rev21_crosswalk.json`
- `docs/data/naics_nace_crosswalk.json`
- `public/data/naics_nace_crosswalk.json`

## Test Cases Required
- Verify NAICS 114210 maps to NACE 01.70
- Verify no NAICS codes in Agriculture/Forestry/Fishing map to Manufacturing
- Verify conceptual alignment between ISIC and NACE mappings

---
**Report Generated:** $(date)  
**Investigation Priority:** HIGH  
**Status:** CORRECTIONS REQUIRED