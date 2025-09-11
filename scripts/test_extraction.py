#!/usr/bin/env python3
"""
Test script to validate the improved OECD extraction against all criteria
"""

import sys
import json
from pathlib import Path
import re

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.extract_oecd_pdfs import PDFExtractor

def test_validation_criteria():
    """Test all validation criteria with sample files"""
    
    print("OECD PDF Extraction Validation Test")
    print("=" * 60)
    
    # Initialize extractor
    extractor = PDFExtractor(
        input_dir="data",
        output_dir="out/test",
        verbose=False
    )
    
    # Test file
    test_file = "OECD_TPG_ES_2010.pdf"
    pdf_path = Path("data") / test_file
    
    if not pdf_path.exists():
        print(f"ERROR: Test file not found: {test_file}")
        return False
    
    print(f"Processing: {test_file}")
    print("-" * 40)
    
    # Extract content
    result = extractor.process_pdf(pdf_path)
    
    if not result:
        print("ERROR: Extraction failed")
        return False
    
    # Run validation tests
    tests_passed = 0
    total_tests = 5
    
    # Test 1: Copyright Footer Removal
    print("\n1. Copyright Footer Removal Test")
    copyright_count = 0
    total_items = sum(len(items) for items in result['sections'].values())
    
    for section, items in result['sections'].items():
        for item in items:
            text = item['text'].lower()
            if any(term in text for term in ['© ocde', '© oecd', 'copyright', 'directrices de la ocde aplicables']):
                copyright_count += 1
    
    removal_rate = (1 - copyright_count/total_items) * 100
    if removal_rate > 80:
        print(f"   PASS: {removal_rate:.1f}% removal rate ({copyright_count}/{total_items} items)")
        tests_passed += 1
    else:
        print(f"   FAIL: {removal_rate:.1f}% removal rate (target >80%)")
    
    # Test 2: Clean JSON Format
    print("\n2. Clean JSON Format Test")
    json_str = json.dumps(result, ensure_ascii=False)
    violations = json_str.count('\\\\n') + json_str.count('\\\\r') + json_str.count('\\\\t')
    
    if violations < 100:
        print(f"   PASS: {violations} escape sequence violations (target <100)")
        tests_passed += 1
    else:
        print(f"   FAIL: {violations} escape sequence violations")
    
    # Test 3: Paragraph ID Structure
    print("\n3. Paragraph ID Structure Test")
    valid_ids = 0
    total_ids = 0
    
    for section, items in result['sections'].items():
        for item in items:
            total_ids += 1
            item_id = item['id']
            # Check OECD-compliant patterns
            patterns = [r'^\d+$', r'^\d+\.\d+$', r'^[A-Z]\d*$', r'^[A-Z]\.\d+$', r'^[IVX]+\.\d+$']
            if any(re.match(pattern, item_id) for pattern in patterns):
                valid_ids += 1
    
    id_rate = (valid_ids/total_ids) * 100
    if id_rate > 95:
        print(f"   PASS: {id_rate:.1f}% valid IDs ({valid_ids}/{total_ids})")
        tests_passed += 1
    else:
        print(f"   FAIL: {id_rate:.1f}% valid IDs (target >95%)")
    
    # Test 4: Content Section Organization
    print("\n4. Content Section Organization Test")
    sections = list(result['sections'].keys())
    core_sections = sum(1 for s in sections if any(t in s.lower() for t in ['chapter', 'preface']))
    
    if core_sections >= 5:
        print(f"   PASS: {core_sections} core sections found (target >=5)")
        print(f"   Sections: {', '.join(sections[:5])}{'...' if len(sections) > 5 else ''}")
        tests_passed += 1
    else:
        print(f"   FAIL: {core_sections} core sections (target >=5)")
    
    # Test 5: Text Flow Quality
    print("\n5. Text Flow Quality Test")
    short_fragments = 0
    proper_paragraphs = 0
    
    for section, items in result['sections'].items():
        for item in items:
            if len(item['text']) < 30:
                short_fragments += 1
            else:
                proper_paragraphs += 1
    
    flow_rate = (proper_paragraphs/(short_fragments+proper_paragraphs)) * 100
    if flow_rate > 85:
        print(f"   PASS: {flow_rate:.1f}% quality rate ({proper_paragraphs} proper, {short_fragments} fragments)")
        tests_passed += 1
    else:
        print(f"   FAIL: {flow_rate:.1f}% quality rate (target >85%)")
    
    # Summary
    print("\n" + "=" * 60)
    print(f"VALIDATION SUMMARY")
    print(f"   Tests Passed: {tests_passed}/{total_tests}")
    print(f"   Success Rate: {(tests_passed/total_tests)*100:.1f}%")
    
    if tests_passed == total_tests:
        print(f"   Status: EXCELLENT - All criteria passed!")
        quality = "EXCELLENT"
    elif tests_passed >= 4:
        print(f"   Status: GOOD - Most criteria passed")
        quality = "GOOD"
    else:
        print(f"   Status: NEEDS IMPROVEMENT")
        quality = "NEEDS IMPROVEMENT"
    
    # Show sample output
    print(f"\nEXTRACTION STATISTICS")
    stats = result['extraction_stats']
    print(f"   Pages: {stats['total_pages']}")
    print(f"   Sections: {stats['total_sections']}")
    print(f"   Items: {stats['total_items']}")
    print(f"   Method: {stats['extraction_method']}")
    
    # Sample content
    first_section = list(result['sections'].keys())[0]
    first_item = result['sections'][first_section][0]
    print(f"\nSAMPLE CONTENT")
    print(f"   Section: {first_section}")
    print(f"   ID: {first_item['id']}")
    print(f"   Page: {first_item['page']}")
    print(f"   Text: {first_item['text'][:100]}...")
    
    print("=" * 60)
    
    return tests_passed == total_tests

if __name__ == '__main__':
    success = test_validation_criteria()
    sys.exit(0 if success else 1)