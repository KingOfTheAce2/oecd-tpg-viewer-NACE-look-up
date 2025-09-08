#!/usr/bin/env python3
"""
Fix NAICS 114210 incorrect mapping from NACE 17.1/17.2 to correct 01.70
"""
import json
import csv
import os
import shutil
from pathlib import Path

# Paths to data files
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
CROSSWALKS_DIR = PROJECT_ROOT / 'crosswalks'
DOCS_DATA_DIR = PROJECT_ROOT / 'docs' / 'data'
PUBLIC_DATA_DIR = PROJECT_ROOT / 'public' / 'data'

# File paths
JSON_FILES = [
    CROSSWALKS_DIR / 'NAICS_2022_to_NACE_Rev21_crosswalk.json',
    DOCS_DATA_DIR / 'naics_nace_crosswalk.json',
    PUBLIC_DATA_DIR / 'naics_nace_crosswalk.json'
]
CSV_FILE = CROSSWALKS_DIR / 'NAICS_2022_to_NACE_Rev21_crosswalk.csv'

def backup_files():
    """Create backups of original files"""
    print("Creating backups...")
    for file_path in JSON_FILES + [CSV_FILE]:
        if file_path.exists():
            backup_path = file_path.with_suffix(f'.backup{file_path.suffix}')
            shutil.copy2(file_path, backup_path)
            print(f"  Backed up: {file_path} -> {backup_path}")

def fix_json_files():
    """Fix JSON files by correcting NAICS 114210 mappings"""
    print("Fixing JSON files...")
    
    corrections_made = {}
    
    for json_file in JSON_FILES:
        if not json_file.exists():
            print(f"  WARNING: {json_file} does not exist, skipping")
            continue
            
        print(f"  Processing: {json_file}")
        
        # Load data
        with open(json_file, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        
        # Handle different JSON structures
        if isinstance(json_data, dict) and 'crosswalk' in json_data:
            data = json_data['crosswalk']
            has_metadata = True
        elif isinstance(json_data, dict) and 'mappings' in json_data:
            data = json_data['mappings']
            has_metadata = True
        elif isinstance(json_data, list):
            data = json_data
            has_metadata = False
        else:
            print(f"    ERROR: Unexpected JSON structure: {type(json_data)}, keys: {list(json_data.keys()) if isinstance(json_data, dict) else 'N/A'}")
            continue
            
        # Find and fix NAICS 114210 records
        corrections = []
        for i, record in enumerate(data):
            if record.get('naics2022Code') == '114210':
                # Check if this is an incorrect mapping to NACE 17.x
                if record.get('naceRev21Code', '').startswith('17.'):
                    original = dict(record)
                    
                    # Fix the mapping to NACE 01.70
                    record['naceRev2Code'] = '01.70'
                    record['naceRev2Title'] = 'Hunting, trapping and related service activities'
                    record['naceRev21Code'] = '01.70'
                    record['naceRev21Title'] = 'Hunting, trapping and related service activities'
                    
                    corrections.append({
                        'index': i,
                        'original_nace': original.get('naceRev21Code'),
                        'original_title': original.get('naceRev21Title'),
                        'corrected_nace': record['naceRev21Code'],
                        'corrected_title': record['naceRev21Title']
                    })
        
        # Save corrected data
        if corrections:
            with open(json_file, 'w', encoding='utf-8') as f:
                if has_metadata:
                    json.dump(json_data, f, indent=2, ensure_ascii=False)
                else:
                    json.dump(data, f, indent=2, ensure_ascii=False)
            
            corrections_made[str(json_file)] = corrections
            print(f"    Made {len(corrections)} corrections")
        else:
            print(f"    No corrections needed")
    
    return corrections_made

def fix_csv_file():
    """Fix CSV file by correcting NAICS 114210 mappings"""
    print(f"Fixing CSV file: {CSV_FILE}")
    
    if not CSV_FILE.exists():
        print(f"  WARNING: {CSV_FILE} does not exist")
        return []
        
    corrections = []
    rows = []
    
    # Read CSV
    with open(CSV_FILE, 'r', encoding='utf-8', newline='') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        
        for row_num, row in enumerate(reader, 2):  # Start at 2 (header is 1)
            if row['NAICS_2022_Code'] == '114210' and row['NACE_Rev21_Code'].startswith('17.'):
                # Record the correction
                corrections.append({
                    'row': row_num,
                    'original_nace': row['NACE_Rev21_Code'],
                    'original_title': row['NACE_Rev21_Title'],
                    'corrected_nace': '01.70',
                    'corrected_title': 'Hunting, trapping and related service activities'
                })
                
                # Fix the row
                row['NACE_Rev2_Code'] = '01.70'
                row['NACE_Rev2_Title'] = 'Hunting, trapping and related service activities'
                row['NACE_Rev21_Code'] = '01.70'
                row['NACE_Rev21_Title'] = 'Hunting, trapping and related service activities'
            
            rows.append(row)
    
    # Write corrected CSV
    if corrections:
        with open(CSV_FILE, 'w', encoding='utf-8', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        print(f"  Made {len(corrections)} corrections")
    else:
        print(f"  No corrections needed")
    
    return corrections

def verify_corrections():
    """Verify that corrections were applied successfully"""
    print("Verifying corrections...")
    
    # Check JSON files
    for json_file in JSON_FILES:
        if not json_file.exists():
            continue
            
        with open(json_file, 'r', encoding='utf-8') as f:
            json_data = json.load(f)
        
        # Handle different JSON structures
        if isinstance(json_data, dict) and 'crosswalk' in json_data:
            data = json_data['crosswalk']
        elif isinstance(json_data, dict) and 'mappings' in json_data:
            data = json_data['mappings']
        elif isinstance(json_data, list):
            data = json_data
        else:
            print(f"    ERROR: Cannot verify - unexpected JSON structure")
            continue
        
        naics_114210_records = [r for r in data if r.get('naics2022Code') == '114210']
        incorrect_mappings = [r for r in naics_114210_records if r.get('naceRev21Code', '').startswith('17.')]
        correct_mappings = [r for r in naics_114210_records if r.get('naceRev21Code') == '01.70']
        
        print(f"  {json_file.name}:")
        print(f"    Total NAICS 114210 records: {len(naics_114210_records)}")
        print(f"    Incorrect mappings (17.x): {len(incorrect_mappings)}")
        print(f"    Correct mappings (01.70): {len(correct_mappings)}")
    
    # Check CSV file
    if CSV_FILE.exists():
        with open(CSV_FILE, 'r', encoding='utf-8', newline='') as f:
            reader = csv.DictReader(f)
            naics_114210_records = [r for r in reader if r['NAICS_2022_Code'] == '114210']
            
        incorrect_mappings = [r for r in naics_114210_records if r['NACE_Rev21_Code'].startswith('17.')]
        correct_mappings = [r for r in naics_114210_records if r['NACE_Rev21_Code'] == '01.70']
        
        print(f"  {CSV_FILE.name}:")
        print(f"    Total NAICS 114210 records: {len(naics_114210_records)}")
        print(f"    Incorrect mappings (17.x): {len(incorrect_mappings)}")
        print(f"    Correct mappings (01.70): {len(correct_mappings)}")

def main():
    print("NAICS 114210 Mapping Correction Script")
    print("=" * 50)
    
    # Create backups
    backup_files()
    print()
    
    # Fix files
    json_corrections = fix_json_files()
    print()
    csv_corrections = fix_csv_file()
    print()
    
    # Verify corrections
    verify_corrections()
    print()
    
    # Summary
    print("Summary:")
    total_json_corrections = sum(len(corrections) for corrections in json_corrections.values())
    print(f"  JSON files corrected: {len(json_corrections)}")
    print(f"  Total JSON corrections: {total_json_corrections}")
    print(f"  CSV corrections: {len(csv_corrections)}")
    print()
    
    if total_json_corrections > 0 or len(csv_corrections) > 0:
        print("[SUCCESS] Corrections applied successfully!")
        print("[INFO] Next steps: Run tests to validate the corrections")
    else:
        print("[INFO] No corrections were needed")

if __name__ == '__main__':
    main()