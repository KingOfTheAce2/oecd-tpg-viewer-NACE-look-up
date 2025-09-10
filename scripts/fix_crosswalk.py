#!/usr/bin/env python3
"""Fix NAICS-NACE crosswalk issues."""

import csv
import os
import sys

def fix_crosswalk():
    """Fix weird crossovers and use lowest-level NACE codes."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, '..', 'crosswalks', 'NAICS_2022_to_NACE_Rev21_crosswalk.csv')
    
    print(f"Looking for CSV file at: {csv_path}")
    
    if not os.path.exists(csv_path):
        print(f"ERROR: CSV file not found at {csv_path}")
        return
        
    print("FIXING NAICS-NACE CROSSWALK ISSUES...")
    
    fixes_made = []
    
    # Read and process the CSV
    rows = []
    with open(csv_path, 'r', encoding='utf-8', newline='') as f:
        reader = csv.reader(f)
        headers = next(reader)
        
        print(f"Headers: {headers}")
        
        # Find column indices
        nace_code_idx = headers.index('NACE_Rev21_Code')
        naics_code_idx = headers.index('NAICS_2022_Code') 
        nace_title_idx = headers.index('NACE_Rev21_Title')
        naics_title_idx = headers.index('NAICS_2022_Title')
        
        rows.append(headers)
        
        line_num = 2  # Start from line 2 (after header)
        for row in reader:
            if len(row) <= max(nace_code_idx, naics_code_idx):
                rows.append(row)
                continue
                
            naics_code = row[naics_code_idx].strip()
            nace_code = row[nace_code_idx].strip()
            naics_title = row[naics_title_idx].strip()
            nace_title = row[nace_title_idx].strip()
            
            should_fix = False
            new_nace_code = nace_code
            new_nace_title = nace_title
            reason = ""
            
            # Fix 1: Agriculture mapped to tobacco manufacturing (weird crossover)
            if naics_code == '111336' and nace_code == '12':
                # Fruit and Tree Nut Combination Farming should map to growing of fruits
                new_nace_code = '01.25'
                new_nace_title = 'Growing of other tree and bush fruits and nuts'
                reason = 'Fixed agriculture->tobacco crossover: Fruit farming to proper agriculture code'
                should_fix = True
                
            elif naics_code == '111998' and nace_code == '12':
                # All Other Miscellaneous Crop Farming should map to mixed farming
                new_nace_code = '01.50'
                new_nace_title = 'Mixed farming'
                reason = 'Fixed agriculture->tobacco crossover: Mixed crop farming to proper agriculture code'
                should_fix = True
                
            # Fix 2: Replace 2-digit division codes with 4-digit class codes where possible
            elif len(nace_code) == 2 and nace_code.isdigit() and nace_code != '12':
                if nace_code == '01':
                    new_nace_code = '01.19'
                    new_nace_title = 'Growing of other non-perennial crops'
                    reason = 'Made more specific: Division 01 -> Class 01.19'
                    should_fix = True
                elif nace_code == '02':
                    new_nace_code = '02.10' 
                    new_nace_title = 'Silviculture and other forestry activities'
                    reason = 'Made more specific: Division 02 -> Class 02.10'
                    should_fix = True
                elif nace_code == '03':
                    new_nace_code = '03.11'
                    new_nace_title = 'Marine fishing'
                    reason = 'Made more specific: Division 03 -> Class 03.11'
                    should_fix = True
                    
            if should_fix:
                # Apply the fix
                new_row = row.copy()
                new_row[nace_code_idx] = new_nace_code
                new_row[nace_title_idx] = new_nace_title
                rows.append(new_row)
                
                fix_info = {
                    'line': line_num,
                    'naics': naics_code,
                    'naics_title': naics_title,
                    'old_nace': nace_code,
                    'old_nace_title': nace_title,
                    'new_nace': new_nace_code,
                    'new_nace_title': new_nace_title,
                    'reason': reason
                }
                fixes_made.append(fix_info)
                
                print(f"Line {line_num}: NAICS {naics_code} ({naics_title})")
                print(f"  OLD: {nace_code} ({nace_title})")
                print(f"  NEW: {new_nace_code} ({new_nace_title})")
                print(f"  REASON: {reason}")
                print()
            else:
                rows.append(row)
                
            line_num += 1
    
    # Write the fixed CSV back
    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerows(rows)
    
    print("=== CROSSWALK FIXES SUMMARY ===")
    print(f"Fixed {len(fixes_made)} problematic mappings")
    print(f"Updated file: {csv_path}")
    
    if fixes_made:
        print("\\nIssues Fixed:")
        for i, fix in enumerate(fixes_made, 1):
            print(f"{i}. {fix['reason']}")
            print(f"   NAICS {fix['naics']} -> OLD: {fix['old_nace']} -> NEW: {fix['new_nace']}")
    
    print("\\nCrosswalk fixes completed!")
    return len(fixes_made)

if __name__ == '__main__':
    fix_crosswalk()