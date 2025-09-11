#!/usr/bin/env python3
"""
Comprehensive Test Suite for OECD PDF Extraction Validation

Tests the improved extraction script against all specified criteria:
1. Copyright footers are removed
2. JSON format is clean without \\n
3. Paragraph IDs match OECD structure
4. Content sections are properly included/excluded
5. Text flows properly without fragmentation
"""

import sys
import os
import json
import re
import unittest
from pathlib import Path
from typing import Dict, List, Any, Tuple

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.extract_oecd_pdfs import PDFExtractor

class TestOECDExtractionValidation(unittest.TestCase):
    """Test suite for OECD PDF extraction validation"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test environment"""
        cls.test_dir = Path(__file__).parent
        cls.project_root = cls.test_dir.parent
        cls.data_dir = cls.project_root / "data"
        cls.out_dir = cls.project_root / "out"
        cls.test_out_dir = cls.test_dir / "test_output"
        
        # Create test output directory
        cls.test_out_dir.mkdir(exist_ok=True)
        
        # Initialize extractor
        cls.extractor = PDFExtractor(
            input_dir=str(cls.data_dir),
            output_dir=str(cls.test_out_dir),
            verbose=True
        )
        
        # Sample files to test (prioritize smaller ones for faster testing)
        cls.test_files = [
            "OECD_TPG_ES_2010.pdf",  # Smaller file
            "OECD_TPG_FR_2017.pdf",  # Medium file
            "OECD_TPG_EN_2022.pdf"   # Larger file
        ]
        
        cls.extracted_data = {}
        
    def setUp(self):
        """Set up individual test"""
        self.maxDiff = None
        
    def test_01_extract_sample_files(self):
        """Extract sample OECD files for testing"""
        print("\n" + "="*80)
        print("EXTRACTING SAMPLE OECD FILES FOR VALIDATION")
        print("="*80)
        
        for filename in self.test_files:
            pdf_path = self.data_dir / filename
            if pdf_path.exists():
                print(f"\nExtracting {filename}...")
                result = self.extractor.process_pdf(pdf_path)
                
                if result:
                    # Save to test output
                    json_filename = filename.replace('.pdf', '.json')
                    output_path = self.test_out_dir / json_filename
                    
                    with open(output_path, 'w', encoding='utf-8') as f:
                        json.dump(result, f, indent=2, ensure_ascii=False)
                    
                    self.extracted_data[filename] = result
                    print(f"✓ Successfully extracted {filename}")
                    print(f"  - Pages: {result['extraction_stats']['total_pages']}")
                    print(f"  - Sections: {result['extraction_stats']['total_sections']}")
                    print(f"  - Items: {result['extraction_stats']['total_items']}")
                else:
                    self.fail(f"Failed to extract {filename}")
            else:
                print(f"⚠ Skipping {filename} - file not found")
        
        self.assertGreater(len(self.extracted_data), 0, "No files were successfully extracted")
        
    def test_02_copyright_footers_removed(self):
        """Test that copyright footers are properly removed"""
        print("\n" + "="*80)
        print("TESTING COPYRIGHT FOOTER REMOVAL")
        print("="*80)
        
        copyright_patterns = [
            r'©\s*OECD',
            r'Copyright.*OECD',
            r'OECD.*\d{4}',
            r'All rights reserved',
            r'No reproduction.*permission',
            r'www\.oecd\.org',
            r'OECD PUBLISHING',
            r'ISBN\s*\d+',
            r'DOI:\s*\d+'
        ]
        
        for filename, data in self.extracted_data.items():
            print(f"\nAnalyzing {filename}...")
            
            total_items = 0
            copyright_violations = []
            
            for section_name, items in data['sections'].items():
                for item in items:
                    total_items += 1
                    text = item['text'].lower()
                    
                    # Check for copyright patterns
                    for pattern in copyright_patterns:
                        if re.search(pattern, text, re.IGNORECASE):
                            copyright_violations.append({
                                'section': section_name,
                                'item_id': item['id'],
                                'page': item['page'],
                                'pattern': pattern,
                                'text_snippet': text[:100] + '...' if len(text) > 100 else text
                            })
            
            print(f"  - Total items analyzed: {total_items}")
            print(f"  - Copyright violations found: {len(copyright_violations)}")
            
            if copyright_violations:
                print("  - Violations:")
                for violation in copyright_violations[:5]:  # Show first 5
                    print(f"    * Section {violation['section']}, Item {violation['item_id']}, Page {violation['page']}")
                    print(f"      Pattern: {violation['pattern']}")
                    print(f"      Text: {violation['text_snippet']}")
                
                if len(copyright_violations) > 5:
                    print(f"    ... and {len(copyright_violations) - 5} more")
            
            # Assert no copyright footers remain (allow up to 2% for edge cases)
            violation_rate = len(copyright_violations) / total_items * 100
            self.assertLess(violation_rate, 2.0, 
                          f"Too many copyright footers remain in {filename}: {violation_rate:.1f}%")
    
    def test_03_clean_json_format(self):
        """Test that JSON format is clean without \\n artifacts"""
        print("\n" + "="*80)
        print("TESTING CLEAN JSON FORMAT")
        print("="*80)
        
        problematic_patterns = [
            r'\\n',      # Escaped newlines
            r'\\r',      # Escaped carriage returns
            r'\\t',      # Escaped tabs
            r'\\"',      # Escaped quotes in wrong context
            r'\\\\',     # Double escaped backslashes
        ]
        
        for filename, data in self.extracted_data.items():
            print(f"\nAnalyzing JSON format for {filename}...")
            
            # Convert to JSON string to check formatting
            json_str = json.dumps(data, ensure_ascii=False)
            
            total_violations = 0
            violation_details = {}
            
            for pattern in problematic_patterns:
                matches = re.findall(pattern, json_str)
                if matches:
                    total_violations += len(matches)
                    violation_details[pattern] = len(matches)
            
            print(f"  - JSON string length: {len(json_str):,} characters")
            print(f"  - Format violations found: {total_violations}")
            
            if violation_details:
                print("  - Violation breakdown:")
                for pattern, count in violation_details.items():
                    print(f"    * {pattern}: {count} occurrences")
            
            # Check specific text content for cleanliness
            clean_text_violations = 0
            for section_name, items in data['sections'].items():
                for item in items:
                    text = item['text']
                    # Count problematic escape sequences in actual text
                    for pattern in [r'\\n', r'\\r', r'\\t']:
                        if re.search(pattern, text):
                            clean_text_violations += 1
            
            print(f"  - Text content violations: {clean_text_violations}")
            
            # Assert clean format (allow minimal violations for legitimate escaping)
            self.assertLess(clean_text_violations, 10, 
                          f"Too many formatting artifacts in {filename}")
    
    def test_04_paragraph_ids_structure(self):
        """Test that paragraph IDs match OECD structure"""
        print("\n" + "="*80)
        print("TESTING PARAGRAPH ID STRUCTURE")
        print("="*80)
        
        for filename, data in self.extracted_data.items():
            print(f"\nAnalyzing paragraph structure for {filename}...")
            
            sections_analyzed = 0
            id_violations = []
            id_gaps = []
            
            for section_name, items in data['sections'].items():
                sections_analyzed += 1
                
                # Check ID sequence
                expected_id = 1
                for item in items:
                    item_id = item['id']
                    
                    # Check if ID follows OECD structure (numeric, dotted, or letter-based)
                    valid_id_patterns = [
                        r'^\d+$',                    # Simple numeric: 1, 2, 3
                        r'^\d+\.\d+$',              # Dotted numeric: 1.1, 2.3
                        r'^[A-Z]\d*$',              # Letter-based: A, A1, B2
                        r'^[A-Z]\.\d+$',            # Letter.number: A.1, B.2
                        r'^[IVX]+\.\d+$',           # Roman.number: I.1, II.3
                        r'^\d+\.[A-Z]$',            # Number.letter: 1.A, 2.B
                    ]
                    
                    is_valid_id = any(re.match(pattern, item_id) for pattern in valid_id_patterns)
                    
                    if not is_valid_id:
                        id_violations.append({
                            'section': section_name,
                            'item_id': item_id,
                            'issue': 'Invalid ID format'
                        })
                    # For simple numeric IDs, check sequence
                    if item_id.isdigit():
                        actual_id = int(item_id)
                        if actual_id != expected_id:
                            id_gaps.append({
                                'section': section_name,
                                'expected': expected_id,
                                'actual': actual_id,
                                'gap_size': actual_id - expected_id
                            })
                        expected_id = actual_id + 1
                    else:
                        # For structured IDs, just increment the counter
                        expected_id += 1
            
            print(f"  - Sections analyzed: {sections_analyzed}")
            print(f"  - ID format violations: {len(id_violations)}")
            print(f"  - ID sequence gaps: {len(id_gaps)}")
            
            if id_violations:
                print("  - Format violations:")
                for violation in id_violations[:3]:
                    print(f"    * Section {violation['section']}: {violation['issue']} - ID: {violation['item_id']}")
            
            if id_gaps:
                print("  - Sequence gaps:")
                for gap in id_gaps[:3]:
                    print(f"    * Section {gap['section']}: Expected {gap['expected']}, got {gap['actual']} (gap: {gap['gap_size']})")
            
            # Assert reasonable ID structure
            total_items = sum(len(items) for items in data['sections'].values())
            violation_rate = len(id_violations) / max(total_items, 1) * 100
            self.assertLess(violation_rate, 15.0, 
                          f"Too many ID violations in {filename}: {violation_rate:.1f}%")
    
    def test_05_content_sections_inclusion(self):
        """Test that content sections are properly included/excluded"""
        print("\n" + "="*80)
        print("TESTING CONTENT SECTION INCLUSION/EXCLUSION")
        print("="*80)
        
        # Expected sections for OECD documents
        expected_sections = {
            'core_content': [
                'preface', 'chapter', 'introduction'
            ],
            'reference_content': [
                'appendix', 'annex', 'glossary', 'bibliography'
            ],
            'excluded_content': [
                'table_of_contents', 'index', 'copyright', 'isbn'
            ]
        }
        
        for filename, data in self.extracted_data.items():
            print(f"\nAnalyzing content sections for {filename}...")
            
            sections = list(data['sections'].keys())
            section_types = {}
            
            # Categorize sections
            for section in sections:
                section_lower = section.lower()
                categorized = False
                
                for category, patterns in expected_sections.items():
                    for pattern in patterns:
                        if pattern in section_lower:
                            if category not in section_types:
                                section_types[category] = []
                            section_types[category].append(section)
                            categorized = True
                            break
                    if categorized:
                        break
                
                if not categorized:
                    if 'other' not in section_types:
                        section_types['other'] = []
                    section_types['other'].append(section)
            
            print(f"  - Total sections: {len(sections)}")
            for category, section_list in section_types.items():
                print(f"  - {category}: {len(section_list)} sections")
                if len(section_list) <= 5:
                    print(f"    {section_list}")
                else:
                    print(f"    {section_list[:3]} ... and {len(section_list)-3} more")
            
            # Assert proper content inclusion
            core_sections = section_types.get('core_content', [])
            excluded_sections = section_types.get('excluded_content', [])
            
            self.assertGreater(len(core_sections), 0, 
                             f"No core content sections found in {filename}")
            self.assertLess(len(excluded_sections), 2, 
                          f"Too many excluded sections present in {filename}")
    
    def test_06_text_flow_fragmentation(self):
        """Test that text flows properly without fragmentation"""
        print("\n" + "="*80)
        print("TESTING TEXT FLOW AND FRAGMENTATION")
        print("="*80)
        
        for filename, data in self.extracted_data.items():
            print(f"\nAnalyzing text flow for {filename}...")
            
            total_items = 0
            short_fragments = 0
            orphaned_sentences = 0
            proper_paragraphs = 0
            
            fragmentation_issues = []
            
            for section_name, items in data['sections'].items():
                for item in items:
                    total_items += 1
                    text = item['text'].strip()
                    
                    # Check text length and structure
                    if len(text) < 20:
                        short_fragments += 1
                        fragmentation_issues.append({
                            'section': section_name,
                            'item_id': item['id'],
                            'issue': 'Too short',
                            'length': len(text),
                            'text': text[:50]
                        })
                    elif len(text) < 100 and not text.endswith('.') and not text.endswith(':'):
                        orphaned_sentences += 1
                        fragmentation_issues.append({
                            'section': section_name,
                            'item_id': item['id'],
                            'issue': 'Incomplete sentence',
                            'length': len(text),
                            'text': text[:50]
                        })
                    else:
                        proper_paragraphs += 1
                    
                    # Check for common fragmentation patterns
                    fragmentation_patterns = [
                        r'^\d+\.\s*$',          # Just numbers
                        r'^[A-Z]\s*$',          # Single letters
                        r'^\s*[-•]\s*$',        # Just bullet points
                        r'^\s*\([a-z]\)\s*$',   # Just letter labels
                    ]
                    
                    for pattern in fragmentation_patterns:
                        if re.match(pattern, text):
                            fragmentation_issues.append({
                                'section': section_name,
                                'item_id': item['id'],
                                'issue': f'Fragment pattern: {pattern}',
                                'text': text
                            })
            
            print(f"  - Total items: {total_items}")
            print(f"  - Short fragments: {short_fragments}")
            print(f"  - Orphaned sentences: {orphaned_sentences}")
            print(f"  - Proper paragraphs: {proper_paragraphs}")
            print(f"  - Fragmentation issues: {len(fragmentation_issues)}")
            
            if fragmentation_issues:
                print("  - Sample issues:")
                for issue in fragmentation_issues[:3]:
                    print(f"    * Section {issue['section']}, Item {issue['item_id']}: {issue['issue']}")
                    print(f"      Text: '{issue['text']}'")
            
            # Calculate quality metrics
            proper_paragraph_rate = proper_paragraphs / max(total_items, 1) * 100
            fragmentation_rate = len(fragmentation_issues) / max(total_items, 1) * 100
            
            print(f"  - Proper paragraph rate: {proper_paragraph_rate:.1f}%")
            print(f"  - Fragmentation rate: {fragmentation_rate:.1f}%")
            
            # Assert acceptable text flow quality
            self.assertGreater(proper_paragraph_rate, 70.0, 
                             f"Too much fragmentation in {filename}: only {proper_paragraph_rate:.1f}% proper paragraphs")
            self.assertLess(fragmentation_rate, 15.0, 
                          f"Too many fragmentation issues in {filename}: {fragmentation_rate:.1f}%")
    
    def test_07_comprehensive_quality_report(self):
        """Generate comprehensive quality report"""
        print("\n" + "="*80)
        print("COMPREHENSIVE QUALITY REPORT")
        print("="*80)
        
        report = {
            'summary': {
                'files_processed': len(self.extracted_data),
                'total_sections': 0,
                'total_items': 0,
                'total_pages': 0
            },
            'quality_metrics': {},
            'recommendations': []
        }
        
        for filename, data in self.extracted_data.items():
            stats = data['extraction_stats']
            
            # Update summary
            report['summary']['total_sections'] += stats['total_sections']
            report['summary']['total_items'] += stats['total_items']
            report['summary']['total_pages'] += stats['total_pages']
            
            # Quality metrics per file
            quality_score = 0
            max_score = 5
            
            # Check various quality aspects
            sections_count = stats['total_sections']
            items_count = stats['total_items']
            
            # 1. Content volume (good if substantial content)
            if items_count > 100:
                quality_score += 1
            
            # 2. Section structure (good if multiple sections)
            if sections_count >= 5:
                quality_score += 1
            
            # 3. Average items per section (good if balanced)
            avg_items = items_count / max(sections_count, 1)
            if 10 <= avg_items <= 100:
                quality_score += 1
            
            # 4. Extraction method (prefer PyMuPDF)
            if stats['extraction_method'] == 'PyMuPDF':
                quality_score += 1
            
            # 5. Successful processing
            quality_score += 1  # Always 1 if we got here
            
            quality_percentage = (quality_score / max_score) * 100
            
            report['quality_metrics'][filename] = {
                'quality_score': quality_score,
                'quality_percentage': quality_percentage,
                'sections': sections_count,
                'items': items_count,
                'pages': stats['total_pages'],
                'extraction_method': stats['extraction_method'],
                'avg_items_per_section': round(avg_items, 1)
            }
        
        # Generate recommendations
        avg_quality = sum(m['quality_percentage'] for m in report['quality_metrics'].values()) / len(report['quality_metrics'])
        
        if avg_quality < 80:
            report['recommendations'].append("Consider improving extraction algorithms for better quality")
        
        if report['summary']['total_items'] < 1000:
            report['recommendations'].append("Verify that all relevant content is being extracted")
        
        # Print report
        print(f"\nProcessing Summary:")
        print(f"  - Files processed: {report['summary']['files_processed']}")
        print(f"  - Total pages: {report['summary']['total_pages']}")
        print(f"  - Total sections: {report['summary']['total_sections']}")
        print(f"  - Total items: {report['summary']['total_items']}")
        print(f"  - Average quality: {avg_quality:.1f}%")
        
        print(f"\nPer-File Quality Metrics:")
        for filename, metrics in report['quality_metrics'].items():
            print(f"  {filename}:")
            print(f"    - Quality: {metrics['quality_percentage']:.1f}% ({metrics['quality_score']}/5)")
            print(f"    - Content: {metrics['sections']} sections, {metrics['items']} items, {metrics['pages']} pages")
            print(f"    - Method: {metrics['extraction_method']}")
            print(f"    - Avg items/section: {metrics['avg_items_per_section']}")
        
        if report['recommendations']:
            print(f"\nRecommendations:")
            for i, rec in enumerate(report['recommendations'], 1):
                print(f"  {i}. {rec}")
        
        # Save report
        report_path = self.test_out_dir / "quality_report.json"
        with open(report_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
        
        print(f"\nDetailed report saved to: {report_path}")
        
        # Assert overall quality (adjusted threshold for real-world PDFs)
        self.assertGreaterEqual(avg_quality, 60.0, f"Overall quality too low: {avg_quality:.1f}%")
        self.assertGreater(report['summary']['total_items'], 50, "Too few items extracted overall")

def run_validation_tests():
    """Run all validation tests"""
    # Create test suite
    suite = unittest.TestLoader().loadTestsFromTestCase(TestOECDExtractionValidation)
    
    # Run tests with detailed output
    runner = unittest.TextTestRunner(verbosity=2, stream=sys.stdout)
    result = runner.run(suite)
    
    # Return success status
    return result.wasSuccessful()

if __name__ == '__main__':
    print("OECD PDF Extraction Validation Test Suite")
    print("==========================================")
    
    success = run_validation_tests()
    
    if success:
        print("\n✓ All validation tests passed!")
        sys.exit(0)
    else:
        print("\n✗ Some validation tests failed!")
        sys.exit(1)