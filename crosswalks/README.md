# Classification Crosswalks

This directory contains correspondence tables and crosswalks between different industry classification systems.

## Available Crosswalks

### Direct Correspondences
- **NAICS 2022 ↔ ISIC Rev. 4**: Bidirectional mapping between North American and International Standard Industrial Classifications
  - `2022_NAICS_to_ISIC_Rev_4.xlsx`
  - `ISIC_Rev_4_to_2022_NAICS.xlsx`

- **ISIC Rev. 4 ↔ NACE Rev. 2**: Mapping between International and European classifications
  - `ISIC_4_to_NACE_Rev.2.txt`
  - `NACE_Rev.2_to_ISIC_4.txt`

- **NACE Rev. 2 → NACE Rev. 2.1**: Update mapping within European classification
  - `NACE_Rev.2_to_NACE_Rev.2.1.xlsx`

- **ISIC Rev. 4 → ISIC Rev. 5**: Update mapping within International classification  
  - `ISIC4_to_ISIC_5_Correspondence_Table.xlsx`

### Generated Crosswalks
- **NAICS 2022 → NACE Rev. 2.1**: Complete crosswalk mapping (CSV & JSON)
  - `NAICS_2022_to_NACE_Rev21_crosswalk.csv`
  - `NAICS_2022_to_NACE_Rev21_crosswalk.json`

## Crosswalk Creation

The complete NAICS 2022 to NACE Rev. 2.1 crosswalk was created using the following mapping chain:

```
NAICS 2022 → ISIC Rev. 4 → NACE Rev. 2 → NACE Rev. 2.1
```

### Statistics
- **8,017** total mappings created
- **1,012** unique NAICS 2022 codes mapped
- **619** unique NACE Rev. 2.1 codes in results
- **7,920** mappings with complete NACE codes (98.8%)
- **97** mappings with ISIC only (no NACE equivalent)

### Usage

To regenerate the crosswalk:
```bash
node create_naics_nace_crosswalk.js
```

### File Descriptions

| File | Format | Description |
|------|--------|-------------|
| `NAICS_2022_to_NACE_Rev21_crosswalk.csv` | CSV | Complete crosswalk with all mapping details |
| `NAICS_2022_to_NACE_Rev21_crosswalk.json` | JSON | Same data with metadata and structured format |
| `create_naics_nace_crosswalk.js` | JavaScript | Script to generate the crosswalk |

### CSV Columns

- `NAICS_2022_Code`: 6-digit NAICS code
- `NAICS_2022_Title`: NAICS industry description
- `ISIC_Rev4_Code`: Intermediate ISIC Rev. 4 code
- `ISIC_Rev4_Title`: ISIC industry description  
- `NACE_Rev2_Code`: Intermediate NACE Rev. 2 code
- `NACE_Rev2_Title`: NACE Rev. 2 description
- `NACE_Rev21_Code`: Final NACE Rev. 2.1 code
- `NACE_Rev21_Title`: Final NACE Rev. 2.1 description
- `Mapping_Path`: Shows the routing through classification systems
- `Mapping_Notes`: Additional correspondence information
- `NAICS_Partial`: Indicates partial NAICS mapping
- `ISIC_Partial`: Indicates partial ISIC mapping  
- `NACE_Partial`: Indicates partial NACE mapping
- `NACE_Mapping_Type`: Type of NACE Rev. 2 to 2.1 update
- `NACE_Correspondence_Type`: Correspondence classification
- `NACE_Common_Content`: Content overlap description

### Data Quality Notes

- Many-to-many relationships exist between classification systems
- Partial mappings are clearly indicated in the data
- 97 NAICS codes map to ISIC categories without NACE equivalents
- All mapping relationships preserve the original correspondence metadata

## Citation

When using these crosswalks, please acknowledge the source correspondence tables from:
- U.S. Bureau of Labor Statistics (NAICS)
- United Nations Statistics Division (ISIC)
- European Commission (NACE)