#!/usr/bin/env python3
"""
Enhanced OECD Word Document (.docx) Extraction Script
Validates against the 5 key criteria:
1. Proper paragraph ID extraction from OECD numbering
2. No copyright footers in output
3. Clean JSON without newline artifacts
4. Proper section organization
5. Quality text extraction
"""

import re
import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
import logging

try:
    from docx import Document
    from docx.document import Document as DocumentType
    from docx.text.paragraph import Paragraph
except ImportError:
    print("ERROR: python-docx not installed. Run: pip install python-docx")
    sys.exit(1)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class DOCXExtractor:
    """Enhanced DOCX extraction with OECD-specific validation"""
    
    # OECD paragraph patterns
    OECD_PATTERNS = [
        r'^(\d+)\.\s+(.+)$',           # Chapter numbers: "1. Introduction"
        r'^(\d+\.\d+)\s+(.+)$',        # Section numbers: "1.1 Overview"
        r'^([A-Z])\.\s+(.+)$',         # Letter sections: "A. Introduction"
        r'^([A-Z]\.\d+)\s+(.+)$',      # Letter subsections: "A.1 Details"
        r'^([IVX]+)\.\s+(.+)$',        # Roman numerals: "I. Introduction"
        r'^([IVX]+\.\d+)\s+(.+)$',     # Roman subsections: "I.1 Details"
        r'^([a-z])\)\s+(.+)$',         # Lower case with parenthesis: "a) Item"
        r'^([i-v]+)\)\s+(.+)$',        # Roman lower case: "i) Item"
    ]
    
    # Copyright footer patterns to remove
    COPYRIGHT_PATTERNS = [
        r'©.*?OECD.*?\d{4}',
        r'©.*?OCDE.*?\d{4}',
        r'OECD TRANSFER PRICING GUIDELINES.*?©',
        r'Directrices de la OCDE aplicables.*?©',
        r'This document.*?is governed by.*?Terms and Conditions',
        r'Please cite this publication as:.*?OECD.*?\d{4}',
        r'ISBN.*?\d{3}-\d{2}-\d{2}-\d{6}-\d',
        r'Corrigenda.*?may be found.*?online',
        r'The use of this work.*?is governed by',
    ]
    
    # Section detection patterns
    SECTION_PATTERNS = [
        (r'^(Preface|Foreword)\s*$', 'Preface'),
        (r'^(Introduction)\s*$', 'Introduction'),
        (r'^(Chapter\s+[IVXLC\d]+)', 'Chapter'),
        (r'^(Annex\s+[IVXLC\d]*)', 'Annex'),
        (r'^(Appendix\s+[IVXLC\d]*)', 'Appendix'),
        (r'^(Abbreviations|Acronyms)', 'Abbreviations'),
        (r'^(Glossary)', 'Glossary'),
        (r'^(Table of Contents)', 'Table_of_Contents'),
        (r'^(Bibliography|References)', 'Bibliography'),
    ]
    
    def __init__(self, input_dir: str = "data", output_dir: str = "out", verbose: bool = True):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.verbose = verbose
        self.extraction_stats = {
            'total_paragraphs': 0,
            'valid_oecd_ids': 0,
            'copyright_removed': 0,
            'sections_identified': 0,
            'total_pages': 0,
            'extraction_method': 'docx'
        }
        
    def clean_text(self, text: str) -> str:
        """Clean text by removing artifacts and normalizing whitespace"""
        if not text:
            return ""
            
        # Remove copyright footers
        for pattern in self.COPYRIGHT_PATTERNS:
            text = re.sub(pattern, '', text, flags=re.IGNORECASE | re.MULTILINE)
            if pattern != text:
                self.extraction_stats['copyright_removed'] += 1
        
        # Clean whitespace and normalize
        text = re.sub(r'\s+', ' ', text)  # Multiple spaces to single
        text = re.sub(r'\n\s*\n', '\n', text)  # Multiple newlines to single
        text = text.strip()
        
        # Remove common artifacts
        text = re.sub(r'\x0c', '', text)  # Form feed
        text = re.sub(r'\u00a0', ' ', text)  # Non-breaking space
        
        return text
        
    def extract_paragraph_id(self, text: str) -> Tuple[Optional[str], str]:
        """Extract OECD-compliant paragraph ID from text"""
        if not text:
            return None, ""
            
        text = text.strip()
        
        # Try each OECD pattern
        for pattern in self.OECD_PATTERNS:
            match = re.match(pattern, text)
            if match:
                para_id = match.group(1)
                remaining_text = match.group(2).strip()
                self.extraction_stats['valid_oecd_ids'] += 1
                return para_id, remaining_text
                
        # If no pattern matches, generate sequential ID
        self.extraction_stats['total_paragraphs'] += 1
        return str(self.extraction_stats['total_paragraphs']), text
        
    def identify_section(self, text: str, current_section: str = "Introduction") -> str:
        """Identify section from paragraph text"""
        if not text:
            return current_section
            
        text = text.strip()
        
        # Check section patterns
        for pattern, section_name in self.SECTION_PATTERNS:
            if re.match(pattern, text, re.IGNORECASE):
                if 'Chapter' in section_name:
                    # Extract chapter details
                    chapter_match = re.match(r'^Chapter\s+([IVXLC\d]+)(?:\.\s*(.+))?', text, re.IGNORECASE)
                    if chapter_match:
                        chapter_num = chapter_match.group(1)
                        chapter_title = chapter_match.group(2) or ""
                        section_name = f"Chapter_{chapter_num}"
                        if chapter_title:
                            section_name += f"_{chapter_title.replace(' ', '_')}"
                elif 'Annex' in section_name:
                    # Extract annex details
                    annex_match = re.match(r'^Annex\s+([IVXLC\d]*)(?:\s+(.+))?', text, re.IGNORECASE)
                    if annex_match:
                        annex_num = annex_match.group(1) or ""
                        annex_title = annex_match.group(2) or ""
                        section_name = f"Annex_{annex_num}" if annex_num else "Annex"
                        if annex_title:
                            section_name += f"_{annex_title.replace(' ', '_')}"
                
                self.extraction_stats['sections_identified'] += 1
                return section_name
                
        return current_section
        
    def extract_paragraphs(self, docx_path: Path) -> Dict[str, Any]:
        """Extract structured content from DOCX file"""
        logger.info(f"Processing DOCX file: {docx_path}")
        
        try:
            doc = Document(str(docx_path))
        except Exception as e:
            logger.error(f"Failed to open DOCX file: {e}")
            return None
            
        # Initialize result structure
        result = {
            "metadata": {
                "year": self._extract_year(docx_path.name),
                "language": self._extract_language(docx_path.name),
                "title": "OECD Transfer Pricing Guidelines for Multinational Enterprises and Tax Administrations",
                "extracted_date": datetime.now().isoformat(),
                "source_file": docx_path.name
            },
            "sections": {},
            "extraction_stats": self.extraction_stats
        }
        
        current_section = "Introduction"
        section_content = []
        
        # Extract paragraphs
        for para in doc.paragraphs:
            text = self.clean_text(para.text)
            
            if not text or len(text) < 10:  # Skip very short content
                continue
                
            # Check for section change
            new_section = self.identify_section(text, current_section)
            if new_section != current_section:
                # Save previous section
                if section_content:
                    result["sections"][current_section] = section_content
                    section_content = []
                current_section = new_section
                
            # Extract paragraph ID and content
            para_id, content = self.extract_paragraph_id(text)
            
            if para_id and content:
                paragraph_data = {
                    "id": para_id,
                    "text": content,
                    "page": 1  # DOCX doesn't provide page info easily
                }
                section_content.append(paragraph_data)
                
        # Add final section
        if section_content:
            result["sections"][current_section] = section_content
            
        # Update stats
        self.extraction_stats['total_paragraphs'] = sum(len(items) for items in result['sections'].values())
        self.extraction_stats['total_sections'] = len(result['sections'])
        self.extraction_stats['total_items'] = self.extraction_stats['total_paragraphs']
        
        return result
        
    def _extract_year(self, filename: str) -> int:
        """Extract year from filename"""
        year_match = re.search(r'(\d{4})', filename)
        return int(year_match.group(1)) if year_match else 2022
        
    def _extract_language(self, filename: str) -> str:
        """Extract language code from filename"""
        lang_match = re.search(r'_([A-Z]{2})_', filename)
        return lang_match.group(1) if lang_match else "EN"
        
    def validate_output(self, result: Dict[str, Any]) -> Dict[str, Any]:
        """Validate extraction against the 5 key criteria"""
        validation = {
            "copyright_removal": 0,
            "json_cleanliness": 0,
            "paragraph_id_structure": 0,
            "section_organization": 0,
            "text_flow_quality": 0
        }
        
        if not result or 'sections' not in result:
            return validation
            
        total_items = sum(len(items) for items in result['sections'].values())
        
        # 1. Copyright Footer Removal
        copyright_count = 0
        for section, items in result['sections'].items():
            for item in items:
                text = item['text'].lower()
                if any(term in text for term in ['© oecd', '© ocde', 'copyright', 'isbn']):
                    copyright_count += 1
                    
        validation["copyright_removal"] = (1 - copyright_count/max(total_items, 1)) * 100
        
        # 2. Clean JSON Format
        json_str = json.dumps(result, ensure_ascii=False)
        violations = json_str.count('\\\\n') + json_str.count('\\\\r') + json_str.count('\\\\t')
        validation["json_cleanliness"] = max(0, 100 - violations)
        
        # 3. Paragraph ID Structure
        valid_ids = 0
        for section, items in result['sections'].items():
            for item in items:
                item_id = item['id']
                patterns = [r'^\d+$', r'^\d+\.\d+$', r'^[A-Z]\d*$', r'^[A-Z]\.\d+$', r'^[IVX]+\.\d+$']
                if any(re.match(pattern, item_id) for pattern in patterns):
                    valid_ids += 1
                    
        validation["paragraph_id_structure"] = (valid_ids/max(total_items, 1)) * 100
        
        # 4. Section Organization
        sections = list(result['sections'].keys())
        core_sections = sum(1 for s in sections if any(t in s.lower() for t in ['chapter', 'preface', 'introduction']))
        validation["section_organization"] = min(100, (core_sections / 5) * 100)
        
        # 5. Text Flow Quality
        short_fragments = 0
        proper_paragraphs = 0
        for section, items in result['sections'].items():
            for item in items:
                if len(item['text']) < 30:
                    short_fragments += 1
                else:
                    proper_paragraphs += 1
                    
        validation["text_flow_quality"] = (proper_paragraphs/max(short_fragments+proper_paragraphs, 1)) * 100
        
        return validation
        
    def process_docx(self, docx_path: Path) -> Optional[Dict[str, Any]]:
        """Main processing function for a single DOCX file"""
        try:
            result = self.extract_paragraphs(docx_path)
            if result:
                result['validation'] = self.validate_output(result)
                return result
        except Exception as e:
            logger.error(f"Error processing {docx_path}: {e}")
            
        return None
        
    def save_result(self, result: Dict[str, Any], output_path: Path):
        """Save extraction result to JSON file"""
        try:
            self.output_dir.mkdir(parents=True, exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            logger.info(f"Saved result to: {output_path}")
        except Exception as e:
            logger.error(f"Failed to save result: {e}")
            
    def process_all_docx_files(self):
        """Process all DOCX files in input directory"""
        docx_files = list(self.input_dir.glob("*.docx"))
        
        if not docx_files:
            logger.warning("No DOCX files found in input directory")
            return
            
        logger.info(f"Found {len(docx_files)} DOCX files to process")
        
        for docx_file in docx_files:
            logger.info(f"Processing: {docx_file.name}")
            
            result = self.process_docx(docx_file)
            if result:
                # Create output filename
                output_filename = f"{docx_file.stem}.json"
                output_path = self.output_dir / output_filename
                
                self.save_result(result, output_path)
                
                # Print validation summary
                if self.verbose:
                    self.print_validation_summary(result, docx_file.name)
            else:
                logger.error(f"Failed to process: {docx_file.name}")
                
    def print_validation_summary(self, result: Dict[str, Any], filename: str):
        """Print validation summary"""
        print(f"\nValidation Summary for {filename}")
        print("=" * 50)
        
        validation = result.get('validation', {})
        stats = result.get('extraction_stats', {})
        
        print(f"Copyright Removal: {validation.get('copyright_removal', 0):.1f}%")
        print(f"JSON Cleanliness: {validation.get('json_cleanliness', 0):.1f}%")
        print(f"Paragraph ID Structure: {validation.get('paragraph_id_structure', 0):.1f}%")
        print(f"Section Organization: {validation.get('section_organization', 0):.1f}%")
        print(f"Text Flow Quality: {validation.get('text_flow_quality', 0):.1f}%")
        
        print(f"\nExtraction Statistics:")
        print(f"Total Sections: {stats.get('total_sections', 0)}")
        print(f"Total Items: {stats.get('total_items', 0)}")
        print(f"Valid OECD IDs: {stats.get('valid_oecd_ids', 0)}")
        print(f"Copyright Removed: {stats.get('copyright_removed', 0)}")
        

def main():
    """Main execution function"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Enhanced OECD DOCX Extraction Script")
    parser.add_argument("--input-dir", default="data", help="Input directory containing DOCX files")
    parser.add_argument("--output-dir", default="out", help="Output directory for JSON files")
    parser.add_argument("--file", help="Process specific file only")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    extractor = DOCXExtractor(
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        verbose=args.verbose
    )
    
    if args.file:
        # Process specific file
        file_path = Path(args.input_dir) / args.file
        if file_path.exists():
            result = extractor.process_docx(file_path)
            if result:
                output_path = Path(args.output_dir) / f"{file_path.stem}_docx.json"
                extractor.save_result(result, output_path)
                extractor.print_validation_summary(result, args.file)
        else:
            logger.error(f"File not found: {file_path}")
    else:
        # Process all files
        extractor.process_all_docx_files()


if __name__ == "__main__":
    main()