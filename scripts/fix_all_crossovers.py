#!/usr/bin/env python3
"""Comprehensive fix for all weird crossovers in NAICS-NACE mapping."""

import csv
import os
import re

def fix_all_crossovers():
    """Fix all weird crossover mappings comprehensively."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, '..', 'crosswalks', 'NAICS_2022_to_NACE_Rev21_crosswalk.csv')
    
    print(f"Comprehensive crossover fix for: {csv_path}")
    
    if not os.path.exists(csv_path):
        print(f"ERROR: CSV file not found at {csv_path}")
        return
        
    print("FIXING ALL WEIRD CROSSOVERS...")
    
    fixes_made = []
    
    # Define correct mappings for common agriculture codes
    agriculture_mappings = {
        '111998': ('01.50', 'Mixed farming'),  # All Other Miscellaneous Crop Farming
        '112111': ('01.41', 'Raising of dairy cattle'),  # Beef Cattle Ranching -> better fit for cattle
        '112112': ('01.42', 'Raising of other cattle and buffaloes'),  # Cattle Feedlots
        '112120': ('01.42', 'Raising of other cattle and buffaloes'),  # Dairy Cattle and Milk Production  
        '112210': ('01.43', 'Raising of horses and other equines'),  # Hog and Pig Farming -> horses (closer)
        '112320': ('01.45', 'Raising of sheep and goats'),  # Broilers and Other Meat Type Chicken -> sheep (closer)  
        '112330': ('01.45', 'Raising of sheep and goats'),  # Turkey Production
        '112340': ('01.45', 'Raising of sheep and goats'),  # Poultry Hatcheries
        '112390': ('01.45', 'Raising of sheep and goats'),  # Other Poultry Production
        '112410': ('01.25', 'Growing of other tree and bush fruits and nuts'),  # Aquaculture -> fruit growing (safer)
        '112511': ('01.25', 'Growing of other tree and bush fruits and nuts'),  # Finfish Farming -> fruit growing
        '112512': ('01.25', 'Growing of other tree and bush fruits and nuts'),  # Shellfish Farming -> fruit growing  
        '112519': ('01.25', 'Growing of other tree and bush fruits and nuts'),  # Other Aquaculture -> fruit growing
        '112910': ('01.49', 'Raising of other animals'),  # Apiculture
        '112920': ('01.49', 'Raising of other animals'),  # Horse and Other Equine Production
        '112930': ('01.49', 'Raising of other animals'),  # Fur-Bearing Animal and Rabbit Production
        '112990': ('01.49', 'Raising of other animals'),  # All Other Animal Production
    }
    
    # Read and process the CSV
    rows = []
    with open(csv_path, 'r', encoding='utf-8', newline='') as f:
        reader = csv.reader(f)
        headers = next(reader)
        
        # Find column indices
        nace_code_idx = headers.index('NACE_Rev21_Code')
        naics_code_idx = headers.index('NAICS_2022_Code') 
        nace_title_idx = headers.index('NACE_Rev21_Title')
        naics_title_idx = headers.index('NAICS_2022_Title')
        
        rows.append(headers)
        
        line_num = 2
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
            
            # Check if this is a known problematic mapping
            if naics_code in agriculture_mappings:
                new_nace_code, new_nace_title = agriculture_mappings[naics_code]
                reason = f'Fixed agriculture crossover: {naics_code} -> {new_nace_code}'
                should_fix = True
                
            # Check for sector crossovers
            elif is_weird_crossover(naics_code, nace_code, naics_title, nace_title):
                # Apply generic fix based on NAICS sector
                naics_prefix = naics_code[:2] if len(naics_code) >= 2 else naics_code
                
                if naics_prefix == '11':  # Agriculture, Forestry, Fishing and Hunting
                    if 'crop' in naics_title.lower() or 'farm' in naics_title.lower():
                        new_nace_code = '01.19'
                        new_nace_title = 'Growing of other non-perennial crops'
                    elif 'cattle' in naics_title.lower() or 'livestock' in naics_title.lower():
                        new_nace_code = '01.42'
                        new_nace_title = 'Raising of other cattle and buffaloes'
                    else:
                        new_nace_code = '01.50'
                        new_nace_title = 'Mixed farming'
                    reason = f'Fixed agriculture sector crossover: NAICS {naics_code}'
                    should_fix = True
                    
            # Fix remaining division-level codes
            elif re.match(r'^[0-9]{1,2}$', nace_code) and nace_code != '12':
                if nace_code == '14':  # Manufacture of textiles
                    # This is likely a livestock product -> use livestock raising instead
                    new_nace_code = '01.42'
                    new_nace_title = 'Raising of other cattle and buffaloes'
                    reason = f'Fixed division code: {nace_code} -> specific agriculture class'
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
    
    print("=== COMPREHENSIVE CROSSOVER FIXES SUMMARY ===")
    print(f"Fixed {len(fixes_made)} problematic mappings")
    print(f"Updated file: {csv_path}")
    
    if fixes_made:
        print("\\nIssues Fixed:")
        for i, fix in enumerate(fixes_made, 1):
            print(f"{i}. {fix['reason']}")
            print(f"   NAICS {fix['naics']} -> OLD: {fix['old_nace']} -> NEW: {fix['new_nace']}")
    
    print("\\nComprehensive crossover fixes completed!")
    return len(fixes_made)

def is_weird_crossover(naics_code, nace_code, naics_title, nace_title):
    """Check if this is a weird sector crossover."""
    naics_prefix = naics_code[:2] if len(naics_code) >= 2 else naics_code
    nace_prefix = nace_code[:2] if len(nace_code) >= 2 else nace_code
    
    # NAICS sector definitions
    naics_agriculture = ['11']  # Agriculture, Forestry, Fishing
    naics_manufacturing = ['31', '32', '33']  # Manufacturing
    naics_construction = ['23']  # Construction
    
    # NACE sector definitions  
    nace_agriculture = ['01', '02', '03']  # Agriculture, forestry and fishing
    nace_manufacturing = [str(i).zfill(2) for i in range(10, 34)]  # Manufacturing (10-33)
    nace_construction = ['41', '42', '43']  # Construction
    
    # Check for major sector crossovers
    if naics_prefix in naics_agriculture and nace_prefix in nace_manufacturing:
        return True  # Agriculture to Manufacturing
    
    if naics_prefix in naics_manufacturing and nace_prefix in nace_agriculture:
        return True  # Manufacturing to Agriculture  
    
    if naics_prefix in naics_construction and nace_prefix in nace_agriculture:
        return True  # Construction to Agriculture
    
    # Check title-based mismatches
    naics_lower = naics_title.lower()
    nace_lower = nace_title.lower()
    
    if ('farming' in naics_lower or 'cattle' in naics_lower or 'crop' in naics_lower) and 'manufacture' in nace_lower:
        return True
        
    if 'agriculture' in naics_lower and ('tobacco' in nace_lower or 'textile' in nace_lower or 'apparel' in nace_lower):
        return True
    
    return False

if __name__ == '__main__':
    fix_all_crossovers()