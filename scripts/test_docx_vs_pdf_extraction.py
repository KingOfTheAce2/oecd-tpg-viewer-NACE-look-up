#!/usr/bin/env python3
"""
Comprehensive test script to validate Word document extraction
against PDF extraction and the 5 key criteria:
1. Proper paragraph ID extraction from OECD numbering
2. No copyright footers in output
3. Clean JSON without newline artifacts
4. Proper section organization
5. Quality text extraction
"""

import sys
import json
import re
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Tuple
import argparse

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from scripts.extract_oecd_docx import DOCXExtractor
except ImportError:
    print("ERROR: Could not import DOCXExtractor")
    sys.exit(1)

class ExtractionComparator:
    """Compare Word and PDF extraction results"""
    
    def __init__(self, verbose: bool = True):
        self.verbose = verbose
        self.test_results = {}
        
    def load_pdf_result(self, pdf_json_path: Path) -> Dict[str, Any]:
        """Load existing PDF extraction result"""
        try:
            with open(pdf_json_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"ERROR: Could not load PDF result: {e}")
            return None
            
    def run_docx_extraction(self, docx_path: Path, output_dir: Path) -> Dict[str, Any]:
        """Run Word document extraction"""
        extractor = DOCXExtractor(
            input_dir=str(docx_path.parent),
            output_dir=str(output_dir),
            verbose=self.verbose
        )
        
        result = extractor.process_docx(docx_path)
        if result:
            # Save the result
            output_path = output_dir / f"{docx_path.stem}_docx.json"
            extractor.save_result(result, output_path)
            
        return result
        
    def validate_five_criteria(self, result: Dict[str, Any], test_name: str) -> Dict[str, float]:
        """Validate extraction against the 5 key criteria"""
        validation = {
            "copyright_removal": 0.0,
            "json_cleanliness": 0.0,
            "paragraph_id_structure": 0.0,
            "section_organization": 0.0,
            "text_flow_quality": 0.0
        }
        
        if not result or 'sections' not in result:
            return validation
            
        total_items = sum(len(items) for items in result['sections'].values())
        
        # 1. Copyright Footer Removal Test
        copyright_count = 0
        copyright_patterns = ['© oecd', '© ocde', 'copyright', 'isbn', 'issn', 'corrigenda', 'publishing, paris']
        
        for section, items in result['sections'].items():
            for item in items:
                text = item['text'].lower()
                if any(pattern in text for pattern in copyright_patterns):
                    copyright_count += 1
                    
        validation["copyright_removal"] = (1 - copyright_count/max(total_items, 1)) * 100
        
        # 2. Clean JSON Format Test
        json_str = json.dumps(result, ensure_ascii=False)
        newline_violations = json_str.count('\\\\n') + json_str.count('\\\\r')
        tab_violations = json_str.count('\\\\t')
        total_violations = newline_violations + tab_violations
        
        # Score based on violation density
        if total_violations == 0:
            validation["json_cleanliness"] = 100.0
        else:
            violation_density = total_violations / len(json_str) * 1000  # per 1000 chars
            validation["json_cleanliness"] = max(0, 100 - violation_density * 10)
        
        # 3. Paragraph ID Structure Test
        valid_ids = 0
        oecd_patterns = [
            r'^\d+$',           # Simple numbers: "1"
            r'^\d+\.\d+$',      # Section numbers: "1.1"
            r'^[A-Z]$',         # Letter sections: "A"
            r'^[A-Z]\.\d+$',    # Letter subsections: "A.1"
            r'^[IVX]+$',        # Roman numerals: "I"
            r'^[IVX]+\.\d+$',   # Roman subsections: "I.1"
            r'^[a-z]\)$',       # Lower case with parenthesis: "a)"
            r'^[ivx]+\)$',      # Roman lower case: "i)"
        ]
        
        for section, items in result['sections'].items():
            for item in items:
                item_id = item['id']
                if any(re.match(pattern, item_id) for pattern in oecd_patterns):
                    valid_ids += 1
                    
        validation["paragraph_id_structure"] = (valid_ids/max(total_items, 1)) * 100
        
        # 4. Section Organization Test
        sections = list(result['sections'].keys())
        expected_sections = ['introduction', 'preface', 'chapter', 'annex', 'appendix']
        core_sections = 0
        
        for section in sections:
            section_lower = section.lower()
            if any(expected in section_lower for expected in expected_sections):
                core_sections += 1
                
        validation["section_organization"] = min(100, (core_sections / 5) * 100)
        
        # 5. Text Flow Quality Test
        short_fragments = 0
        proper_paragraphs = 0
        very_short_fragments = 0  # Less than 10 chars
        
        for section, items in result['sections'].items():
            for item in items:
                text_length = len(item['text'])
                if text_length < 10:
                    very_short_fragments += 1
                elif text_length < 30:
                    short_fragments += 1
                else:
                    proper_paragraphs += 1
                    
        total_fragments = short_fragments + proper_paragraphs + very_short_fragments
        if total_fragments > 0:
            quality_score = (proper_paragraphs + 0.5 * short_fragments) / total_fragments * 100
            validation["text_flow_quality"] = quality_score
        else:
            validation["text_flow_quality"] = 0
        
        return validation
        
    def compare_structures(self, docx_result: Dict[str, Any], pdf_result: Dict[str, Any]) -> Dict[str, Any]:
        """Compare structural aspects between Word and PDF extraction"""
        comparison = {
            "section_count_diff": 0,
            "item_count_diff": 0,
            "common_sections": [],
            "docx_only_sections": [],
            "pdf_only_sections": [],
            "section_overlap_rate": 0.0,
            "content_similarity_sample": {}
        }
        
        if not docx_result or not pdf_result:
            return comparison
            
        docx_sections = set(docx_result.get('sections', {}).keys())
        pdf_sections = set(pdf_result.get('sections', {}).keys())
        
        comparison["common_sections"] = list(docx_sections.intersection(pdf_sections))
        comparison["docx_only_sections"] = list(docx_sections - pdf_sections)
        comparison["pdf_only_sections"] = list(pdf_sections - docx_sections)
        
        total_sections = len(docx_sections.union(pdf_sections))
        if total_sections > 0:
            comparison["section_overlap_rate"] = len(comparison["common_sections"]) / total_sections * 100
            
        # Count items
        docx_items = sum(len(items) for items in docx_result.get('sections', {}).values())
        pdf_items = sum(len(items) for items in pdf_result.get('sections', {}).values())
        comparison["item_count_diff"] = abs(docx_items - pdf_items)
        comparison["section_count_diff"] = abs(len(docx_sections) - len(pdf_sections))
        
        # Sample content comparison for common sections
        for section in comparison["common_sections"][:3]:  # First 3 common sections
            docx_items = docx_result['sections'].get(section, [])
            pdf_items = pdf_result['sections'].get(section, [])
            
            if docx_items and pdf_items:
                # Compare first item text length as similarity indicator
                docx_text_len = len(docx_items[0].get('text', ''))
                pdf_text_len = len(pdf_items[0].get('text', ''))
                
                comparison["content_similarity_sample"][section] = {
                    "docx_items": len(docx_items),
                    "pdf_items": len(pdf_items),
                    "first_item_length_ratio": min(docx_text_len, pdf_text_len) / max(docx_text_len, pdf_text_len, 1)
                }
                
        return comparison
        
    def print_detailed_report(self, docx_result: Dict[str, Any], pdf_result: Dict[str, Any], 
                            docx_validation: Dict[str, float], pdf_validation: Dict[str, float],
                            comparison: Dict[str, Any]):
        """Print comprehensive test report"""
        print("\n" + "="*80)
        print("OECD DOCX vs PDF EXTRACTION VALIDATION REPORT")
        print("="*80)
        
        print(f"\nReport Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Validation Results
        print("\n1. FIVE CRITERIA VALIDATION")
        print("-" * 50)
        
        criteria = [
            ("Copyright Removal", "copyright_removal", 80),
            ("JSON Cleanliness", "json_cleanliness", 95),
            ("Paragraph ID Structure", "paragraph_id_structure", 85),
            ("Section Organization", "section_organization", 80),
            ("Text Flow Quality", "text_flow_quality", 85)
        ]
        
        docx_total_score = 0
        pdf_total_score = 0
        
        for name, key, threshold in criteria:
            docx_score = docx_validation.get(key, 0)
            pdf_score = pdf_validation.get(key, 0)
            
            docx_status = "PASS" if docx_score >= threshold else "FAIL"
            pdf_status = "PASS" if pdf_score >= threshold else "FAIL"
            
            print(f"{name:25} | DOCX: {docx_score:6.1f}% ({docx_status}) | PDF: {pdf_score:6.1f}% ({pdf_status}) | Target: >={threshold}%")
            
            docx_total_score += docx_score
            pdf_total_score += pdf_score
            
        docx_avg = docx_total_score / len(criteria)
        pdf_avg = pdf_total_score / len(criteria)
        
        print(f"\n{'OVERALL AVERAGE':25} | DOCX: {docx_avg:6.1f}% | PDF: {pdf_avg:6.1f}%")
        
        # Determine winner
        if docx_avg > pdf_avg:
            winner = "DOCX (Word)"
            advantage = docx_avg - pdf_avg
        elif pdf_avg > docx_avg:
            winner = "PDF"
            advantage = pdf_avg - docx_avg
        else:
            winner = "TIE"
            advantage = 0
            
        print(f"{'WINNER':25} | {winner}" + (f" (+{advantage:.1f}%)" if advantage > 0 else ""))
        
        # Extraction Statistics
        print("\n2. EXTRACTION STATISTICS")
        print("-" * 50)
        
        docx_stats = docx_result.get('extraction_stats', {}) if docx_result else {}
        pdf_metadata = pdf_result.get('metadata', {}) if pdf_result else {}
        
        docx_sections = len(docx_result.get('sections', {})) if docx_result else 0
        pdf_sections = len(pdf_result.get('sections', {})) if pdf_result else 0
        
        docx_items = sum(len(items) for items in docx_result.get('sections', {}).values()) if docx_result else 0
        pdf_items = sum(len(items) for items in pdf_result.get('sections', {}).values()) if pdf_result else 0
        
        print(f"{'Total Sections':20} | DOCX: {docx_sections:6} | PDF: {pdf_sections:6}")
        print(f"{'Total Items':20} | DOCX: {docx_items:6} | PDF: {pdf_items:6}")
        print(f"{'Valid OECD IDs':20} | DOCX: {docx_stats.get('valid_oecd_ids', 0):6} | PDF: N/A")
        print(f"{'Copyright Removed':20} | DOCX: {docx_stats.get('copyright_removed', 0):6} | PDF: N/A")
        
        # Structural Comparison
        print("\n3. STRUCTURAL COMPARISON")
        print("-" * 50)
        
        print(f"Section Overlap Rate: {comparison.get('section_overlap_rate', 0):.1f}%")
        print(f"Section Count Difference: {comparison.get('section_count_diff', 0)}")
        print(f"Item Count Difference: {comparison.get('item_count_diff', 0)}")
        
        common_sections = comparison.get('common_sections', [])
        print(f"Common Sections ({len(common_sections)}): {', '.join(common_sections[:5])}")
        
        docx_only = comparison.get('docx_only_sections', [])
        if docx_only:
            print(f"DOCX-Only Sections ({len(docx_only)}): {', '.join(docx_only[:5])}")
            
        pdf_only = comparison.get('pdf_only_sections', [])
        if pdf_only:
            print(f"PDF-Only Sections ({len(pdf_only)}): {', '.join(pdf_only[:5])}")
        
        # Sample Content Analysis
        print("\n4. SAMPLE CONTENT ANALYSIS")
        print("-" * 50)
        
        similarity_samples = comparison.get('content_similarity_sample', {})
        for section, data in list(similarity_samples.items())[:3]:
            ratio = data.get('first_item_length_ratio', 0)
            print(f"Section '{section}':")
            print(f"  Item Counts - DOCX: {data.get('docx_items', 0)}, PDF: {data.get('pdf_items', 0)}")
            print(f"  Content Similarity: {ratio:.2f} (1.0 = identical length)")
        
        # Quality Assessment
        print("\n5. QUALITY ASSESSMENT")
        print("-" * 50)
        
        if docx_avg >= 90:
            docx_quality = "EXCELLENT"
        elif docx_avg >= 80:
            docx_quality = "GOOD"
        elif docx_avg >= 70:
            docx_quality = "ACCEPTABLE"
        else:
            docx_quality = "NEEDS IMPROVEMENT"
            
        if pdf_avg >= 90:
            pdf_quality = "EXCELLENT"
        elif pdf_avg >= 80:
            pdf_quality = "GOOD"
        elif pdf_avg >= 70:
            pdf_quality = "ACCEPTABLE"
        else:
            pdf_quality = "NEEDS IMPROVEMENT"
        
        print(f"DOCX Extraction Quality: {docx_quality}")
        print(f"PDF Extraction Quality: {pdf_quality}")
        
        # Recommendations
        print("\n6. RECOMMENDATIONS")
        print("-" * 50)
        
        if docx_validation.get('copyright_removal', 0) < 80:
            print("• Improve copyright footer detection and removal in DOCX extraction")
            
        if docx_validation.get('paragraph_id_structure', 0) < 85:
            print("• Enhance OECD paragraph numbering pattern recognition")
            
        if docx_validation.get('section_organization', 0) < 80:
            print("• Better section boundary detection in Word documents")
            
        if comparison.get('section_overlap_rate', 0) < 70:
            print("• Investigate significant structural differences between DOCX and PDF")
            
        if docx_avg > pdf_avg and docx_avg >= 85:
            print("• DOCX extraction is performing well - consider using as primary method")
        elif pdf_avg > docx_avg and pdf_avg >= 85:
            print("• PDF extraction remains superior - continue using as primary method")
        else:
            print("• Both methods need improvement - focus on failing criteria")
        
        print("\n" + "="*80)
        
    def run_comprehensive_test(self, docx_file: str = "OECD_TPG_EN_2022.docx", 
                             pdf_json_file: str = "OECD_TPG_EN_2022.json") -> bool:
        """Run comprehensive test comparing DOCX and PDF extraction"""
        
        # File paths
        data_dir = Path("data")
        out_dir = Path("out")
        test_out_dir = Path("out/test")
        test_out_dir.mkdir(parents=True, exist_ok=True)
        
        docx_path = data_dir / docx_file
        pdf_json_path = out_dir / pdf_json_file
        
        print(f"Testing DOCX extraction with: {docx_file}")
        print(f"Comparing against PDF result: {pdf_json_file}")
        
        # Check files exist
        if not docx_path.exists():
            print(f"ERROR: DOCX file not found: {docx_path}")
            return False
            
        if not pdf_json_path.exists():
            print(f"ERROR: PDF JSON file not found: {pdf_json_path}")
            return False
        
        # Load PDF result
        pdf_result = self.load_pdf_result(pdf_json_path)
        if not pdf_result:
            return False
            
        # Run DOCX extraction
        print("Running DOCX extraction...")
        docx_result = self.run_docx_extraction(docx_path, test_out_dir)
        if not docx_result:
            print("ERROR: DOCX extraction failed")
            return False
        
        # Validate both results
        print("Validating results against 5 criteria...")
        docx_validation = self.validate_five_criteria(docx_result, "DOCX")
        pdf_validation = self.validate_five_criteria(pdf_result, "PDF")
        
        # Compare structures
        comparison = self.compare_structures(docx_result, pdf_result)
        
        # Generate report
        self.print_detailed_report(docx_result, pdf_result, docx_validation, pdf_validation, comparison)
        
        # Return success based on DOCX performance
        docx_avg = sum(docx_validation.values()) / len(docx_validation)
        return docx_avg >= 70  # 70% average as passing threshold


def main():
    """Main execution function"""
    parser = argparse.ArgumentParser(description="Test DOCX vs PDF extraction quality")
    parser.add_argument("--docx-file", default="OECD_TPG_EN_2022.docx", 
                       help="DOCX file to test")
    parser.add_argument("--pdf-json", default="OECD_TPG_EN_2022.json", 
                       help="PDF extraction JSON to compare against")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    comparator = ExtractionComparator(verbose=args.verbose)
    success = comparator.run_comprehensive_test(args.docx_file, args.pdf_json)
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()