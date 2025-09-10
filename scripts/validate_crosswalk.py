#!/usr/bin/env python3
"""Validate the fixed NAICS-NACE crosswalk."""

import csv
import os
import re

def validate_crosswalk():
    """Validate crosswalk quality and specificity."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    csv_path = os.path.join(script_dir, '..', 'crosswalks', 'NAICS_2022_to_NACE_Rev21_crosswalk.csv')
    
    print(f"Validating CSV file at: {csv_path}")
    
    if not os.path.exists(csv_path):
        print(f"ERROR: CSV file not found at {csv_path}")
        return
        
    print("VALIDATING NAICS-NACE CROSSWALK QUALITY...")
    
    stats = {
        'sections': 0,  # 1-digit codes like A, B, C
        'divisions': 0,  # 2-digit codes like 01, 02, 12  
        'groups': 0,    # 3-digit codes like 01.1, 01.2
        'classes': 0,   # 4-digit codes like 01.11, 01.25
        'total': 0,
        'weird_crossovers': 0,
        'examples': {
            'sections': [],
            'divisions': [],
            'groups': [],
            'classes': [],
            'weird': []
        }
    }
    
    with open(csv_path, 'r', encoding='utf-8', newline='') as f:
        reader = csv.reader(f)
        headers = next(reader)
        
        nace_code_idx = headers.index('NACE_Rev21_Code')
        naics_code_idx = headers.index('NAICS_2022_Code')
        nace_title_idx = headers.index('NACE_Rev21_Title')
        naics_title_idx = headers.index('NAICS_2022_Title')
        
        for row in reader:
            if len(row) <= max(nace_code_idx, naics_code_idx):
                continue
                
            naics_code = row[naics_code_idx].strip()
            nace_code = row[nace_code_idx].strip()
            naics_title = row[naics_title_idx].strip()
            nace_title = row[nace_title_idx].strip()
            
            if not nace_code:
                continue
                
            stats['total'] += 1
            
            # Check for weird crossovers
            if is_weird_crossover(naics_code, nace_code, naics_title, nace_title):
                stats['weird_crossovers'] += 1
                if len(stats['examples']['weird']) < 5:
                    stats['examples']['weird'].append({
                        'naics': naics_code,
                        'nace': nace_code,
                        'naics_title': naics_title,
                        'nace_title': nace_title
                    })
            
            # Classify NACE code level
            if re.match(r'^[A-Z]$', nace_code):
                stats['sections'] += 1
                if len(stats['examples']['sections']) < 3:
                    stats['examples']['sections'].append({
                        'naics': naics_code,
                        'nace': nace_code,
                        'nace_title': nace_title
                    })
            elif re.match(r'^[0-9]{1,2}$', nace_code):
                stats['divisions'] += 1
                if len(stats['examples']['divisions']) < 3:
                    stats['examples']['divisions'].append({
                        'naics': naics_code,
                        'nace': nace_code,
                        'nace_title': nace_title
                    })
            elif re.match(r'^[0-9]{1,2}\.[0-9]{1}$', nace_code):
                stats['groups'] += 1
                if len(stats['examples']['groups']) < 3:
                    stats['examples']['groups'].append({
                        'naics': naics_code,
                        'nace': nace_code,
                        'nace_title': nace_title
                    })
            elif re.match(r'^[0-9]{1,2}\.[0-9]{2}$', nace_code):
                stats['classes'] += 1
                if len(stats['examples']['classes']) < 3:
                    stats['examples']['classes'].append({
                        'naics': naics_code,
                        'nace': nace_code,
                        'nace_title': nace_title
                    })
    
    print("\\n=== CROSSWALK VALIDATION RESULTS ===")
    print(f"Total mappings: {stats['total']}")
    print(f"  Class codes (4-digit XX.XX): {stats['classes']} ({stats['classes']/stats['total']*100:.1f}%)")
    print(f"  Group codes (3-digit XX.X): {stats['groups']} ({stats['groups']/stats['total']*100:.1f}%)")  
    print(f"  Division codes (2-digit XX): {stats['divisions']} ({stats['divisions']/stats['total']*100:.1f}%)")
    print(f"  Section codes (1-digit X): {stats['sections']} ({stats['sections']/stats['total']*100:.1f}%)")
    print(f"  Weird crossovers: {stats['weird_crossovers']} ({stats['weird_crossovers']/stats['total']*100:.1f}%)")
    
    print("\\n=== QUALITY ASSESSMENT ===")
    
    class_percentage = (stats['classes'] / stats['total']) * 100
    specific_percentage = ((stats['classes'] + stats['groups']) / stats['total']) * 100
    category_codes = stats['divisions'] + stats['sections']
    
    if category_codes == 0:
        print("EXCELLENT: No category codes (divisions/sections) found!")
    else:
        print(f"ISSUE: {category_codes} category codes still present")
        
        if stats['divisions'] > 0:
            print(f"\\n  Division code examples ({stats['divisions']} total):")
            for ex in stats['examples']['divisions']:
                print(f"    NAICS {ex['naics']} -> NACE {ex['nace']} ({ex['nace_title']})")
        
        if stats['sections'] > 0:
            print(f"\\n  Section code examples ({stats['sections']} total):")
            for ex in stats['examples']['sections']:
                print(f"    NAICS {ex['naics']} -> NACE {ex['nace']} ({ex['nace_title']})")
    
    if class_percentage >= 90:
        print(f"GOOD: {class_percentage:.1f}% are specific 4-digit class codes")
    else:
        print(f"WARNING: Only {class_percentage:.1f}% are 4-digit class codes (target: 90%+)")
    
    if specific_percentage >= 95:
        print(f"ACCEPTABLE: {specific_percentage:.1f}% are specific codes (class + group)")
    else:
        print(f"ISSUE: Only {specific_percentage:.1f}% are specific codes (target: 95%+)")
    
    if stats['weird_crossovers'] == 0:
        print("EXCELLENT: No weird crossovers detected!")
    else:
        print(f"ISSUE: {stats['weird_crossovers']} weird crossovers detected")
        for ex in stats['examples']['weird']:
            print(f"  NAICS {ex['naics']} ({ex['naics_title']}) -> NACE {ex['nace']} ({ex['nace_title']})")
    
    print("\\n=== CLASS CODE EXAMPLES ===")
    for ex in stats['examples']['classes']:
        print(f"  NAICS {ex['naics']} -> NACE {ex['nace']} ({ex['nace_title']})")
    
    print("\\nValidation completed!")
    return stats

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
    nace_manufacturing = list(map(str, range(10, 34)))  # Manufacturing
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
    
    if 'farming' in naics_lower and 'manufacture' in nace_lower:
        return True
        
    if 'agriculture' in naics_lower and 'tobacco' in nace_lower:
        return True
    
    return False

if __name__ == '__main__':
    validate_crosswalk()