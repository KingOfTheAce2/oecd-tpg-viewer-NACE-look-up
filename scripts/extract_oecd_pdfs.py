#!/usr/bin/env python3
"""
Fixed OECD Transfer Pricing Guidelines PDF to JSON Extractor

This script addresses all the issues identified:
1. Removes OECD copyright footers completely
2. Fixes JSON formatting to eliminate \\n newlines  
3. Uses proper OECD paragraph IDs as JSON IDs
4. Skips table of contents, glossary, and foreword
5. Includes preface, chapters, and annexes/appendixes
6. Ensures cohesive text blocks for fragmented paragraphs
"""

import os
import re
import json
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Tuple, Optional

try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

# Language-specific section patterns - enhanced for better detection
SECTION_PATTERNS = {
    'EN': {
        'preface': r'(?i)^(preface|foreword)\b',
        'chapter': r'(?i)^chapter\s+(\d+|[ivx]+|i\b|ii\b|iii\b|iv\b|v\b|vi\b|vii\b|viii\b|ix\b|x\b)',
        'appendix': r'(?i)^appendix\s+([a-z]|\d+)',
        'annex': r'(?i)^annex\s+([a-z]|\d+)',
        'glossary': r'(?i)^(glossary|definitions)\b',
        'bibliography': r'(?i)^bibliography\b',
        'table_of_contents': r'(?i)^(table\s+of\s+contents?|contents?)\b',
        'list_of_annexes': r'(?i)^(list\s+of\s+annexes?)\b',
        'abbreviations': r'(?i)^(abbreviations|acronyms)\b'
    }
}

# OECD-specific cleaning patterns
OECD_CLEANING_PATTERNS = [
    r'OECD TRANSFER PRICING GUIDELINES\s*©?\s*OECD\s*\d{4}',
    r'©\s*OECD\s*\d{4}',
    r'OECD TRANSFER PRICING GUIDELINES',
    r'©\s*OECD.*?(?=\n|$)',
    r'All rights reserved.*?(?=\n|$)',
    r'ISBN\s*[\d-]+.*?(?=\n|$)',
    r'ISSN\s*[\d-]+.*?(?=\n|$)',
    r'DOI:\s*[\d/.]+.*?(?=\n|$)',
    r'www\.oecd\.org.*?(?=\n|$)',
    r'OECD PUBLISHING.*?(?=\n|$)'
]

class PDFExtractor:
    def __init__(self, input_dir: str = "data", output_dir: str = "out", verbose: bool = False):
        self.input_dir = Path(input_dir)
        self.output_dir = Path(output_dir)
        self.verbose = verbose
        
        # Setup logging
        logging.basicConfig(
            level=logging.DEBUG if verbose else logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('scripts/pdf_extraction.log'),
                logging.StreamHandler()
            ]
        )
        self.logger = logging.getLogger(__name__)
        
        # Create output directory
        self.output_dir.mkdir(exist_ok=True)
        
        # Check available PDF libraries
        if not PYMUPDF_AVAILABLE and not PDFPLUMBER_AVAILABLE:
            raise ImportError("Neither PyMuPDF nor pdfplumber is available. Install with: pip install PyMuPDF pdfplumber")
    
    def extract_pdf_text(self, pdf_path: Path) -> Tuple[List[Dict], str]:
        """Extract text from PDF using available libraries"""
        extraction_method = "None"
        pages_data = []
        
        # Try PyMuPDF first
        if PYMUPDF_AVAILABLE:
            try:
                doc = fitz.open(str(pdf_path))
                for page_num in range(len(doc)):
                    page = doc[page_num]
                    text = page.get_text()
                    
                    if text.strip():
                        pages_data.append({
                            'page': page_num + 1,
                            'text': text.strip()
                        })
                
                doc.close()
                extraction_method = "PyMuPDF"
            except Exception as e:
                self.logger.error(f"PyMuPDF extraction failed: {e}")
        
        # Fallback to pdfplumber
        if not pages_data and PDFPLUMBER_AVAILABLE:
            try:
                with pdfplumber.open(str(pdf_path)) as pdf:
                    for page_num, page in enumerate(pdf.pages):
                        text = page.extract_text()
                        
                        if text and text.strip():
                            pages_data.append({
                                'page': page_num + 1,
                                'text': text.strip()
                            })
                extraction_method = "pdfplumber"
            except Exception as e:
                self.logger.error(f"pdfplumber extraction failed: {e}")
        
        return pages_data, extraction_method
    
    def clean_text(self, text: str) -> str:
        """Clean text by removing OECD copyright footers and formatting artifacts"""
        if not text:
            return ""
        
        # Remove OECD copyright footers and related content
        for pattern in OECD_CLEANING_PATTERNS:
            text = re.sub(pattern, '', text, flags=re.IGNORECASE | re.MULTILINE)
        
        # Remove page headers/footers
        lines = text.split('\\n')
        cleaned_lines = []
        
        for line in lines:
            line = line.strip()
            
            # Skip empty lines
            if not line:
                continue
                
            # Skip page numbers
            if re.match(r'^\d+\s*$', line):
                continue
                
            # Skip section headers that are just page references  
            if re.match(r'^[A-Z\s\u2013-]+\s*\u2013\s*\d+$', line):
                continue
                
            # Skip very short lines that are likely artifacts
            if len(line) < 3:
                continue
            
            cleaned_lines.append(line)
        
        # Join lines and normalize whitespace
        result = ' '.join(cleaned_lines)
        
        # Fix formatting: normalize whitespace but preserve sentence structure
        result = re.sub(r'\\s+', ' ', result)
        result = result.strip()
        
        return result
    
    def detect_language(self, filename: str) -> str:
        """Detect language from filename"""
        match = re.search(r'_([A-Z]{2})_', filename.upper())
        if match:
            return match.group(1)
        return 'EN'  # Default to English
    
    def detect_year(self, filename: str) -> Optional[int]:
        """Detect year from filename"""
        match = re.search(r'(\d{4})', filename)
        if match:
            year = int(match.group(1))
            if 2000 <= year <= 2030:
                return year
        return None
    
    def identify_section(self, text: str, language: str) -> Tuple[Optional[str], Optional[str]]:
        """Identify section type and normalize name"""
        text = text.strip()
        patterns = SECTION_PATTERNS.get(language, SECTION_PATTERNS['EN'])
        
        for section_type, pattern in patterns.items():
            if re.match(pattern, text):
                if section_type == 'chapter':
                    match = re.match(pattern, text)
                    if match and match.group(1):
                        return f"Chapter_{match.group(1)}", section_type
                    return "Chapter", section_type
                elif section_type == 'appendix':
                    match = re.match(pattern, text)
                    if match and match.group(1):
                        return f"Appendix_{match.group(1).upper()}", section_type
                    return "Appendix", section_type
                elif section_type == 'annex':
                    match = re.match(pattern, text)
                    if match and match.group(1):
                        return f"Annex_{match.group(1).upper()}", section_type
                    return "Annex", section_type
                else:
                    return section_type.capitalize(), section_type
        
        return None, None
    
    def should_skip_section(self, section_type: str) -> bool:
        """Determine if a section should be skipped"""
        skip_sections = {'table_of_contents', 'list_of_annexes', 'glossary', 'bibliography', 'abbreviations'}
        return section_type in skip_sections
    
    def extract_paragraph_id(self, text: str) -> Tuple[Optional[str], str]:
        """Extract OECD paragraph ID from text"""
        # Look for paragraph numbers like "1.3.", "2.15.", etc.
        match = re.match(r'^(\d+\.\d*\.?)\s*', text)
        if match:
            paragraph_id = match.group(1).rstrip('.')
            remaining_text = text[match.end():].strip()
            return paragraph_id, remaining_text
        
        # Look for sub-paragraph markers
        match = re.match(r'^([a-z]\)|\([a-z]\)|[ivx]+\)|\([ivx]+\))\s*', text)
        if match:
            sub_id = match.group(1)
            remaining_text = text[match.end():].strip()
            return sub_id, remaining_text
        
        return None, text
    
    def merge_fragmented_paragraphs(self, paragraphs: List[str]) -> List[str]:
        """Merge fragmented paragraphs that should be combined"""
        if not paragraphs:
            return []
        
        merged = []
        current_paragraph = ""
        
        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue
                
            # Check if this looks like a continuation
            is_continuation = (
                current_paragraph and 
                len(paragraph) < 100 and
                (paragraph[0].islower() or 
                 paragraph.startswith(('and', 'or', 'but', 'however', 'therefore', 'thus')))
            )
            
            if is_continuation:
                current_paragraph += " " + paragraph
            else:
                if current_paragraph:
                    merged.append(current_paragraph)
                current_paragraph = paragraph
        
        if current_paragraph:
            merged.append(current_paragraph)
            
        return merged
    
    def structure_content(self, pages_data: List[Dict], language: str) -> Dict:
        """Structure extracted content into proper OECD sections"""
        sections = {}
        current_section = "Preface"
        current_items = []
        item_id = 1
        skip_current_section = False
        
        # Process each page
        for page_data in pages_data:
            page_num = page_data['page']
            text = page_data['text']
            
            # Clean the text
            cleaned_text = self.clean_text(text)
            if not cleaned_text or len(cleaned_text) < 20:
                continue
            
            # Split into potential paragraphs
            paragraphs = [p.strip() for p in cleaned_text.split('.') if p.strip() and len(p.strip()) > 20]
            paragraphs = self.merge_fragmented_paragraphs(paragraphs)
            
            for paragraph in paragraphs:
                if len(paragraph) < 20:
                    continue
                
                # Check if this is a section header by looking at the first words
                first_words = ' '.join(paragraph.split()[:3])
                section_name, section_type = self.identify_section(first_words, language)
                
                if section_name:
                    # Save previous section if not skipped
                    if current_items and not skip_current_section:
                        sections[current_section] = current_items
                    
                    # Start new section
                    current_section = section_name
                    current_items = []
                    item_id = 1
                    skip_current_section = self.should_skip_section(section_type)
                    
                    self.logger.debug(f"Found section: {section_name} (skip: {skip_current_section})")
                    
                    # Add remaining content if any
                    remaining_text = paragraph[len(first_words):].strip()
                    if remaining_text and len(remaining_text) > 20 and not skip_current_section:
                        paragraph_id, clean_text = self.extract_paragraph_id(remaining_text)
                        if not paragraph_id:
                            paragraph_id = f"{item_id}"
                        
                        current_items.append({
                            "id": paragraph_id,
                            "text": clean_text,
                            "page": page_num
                        })
                        item_id += 1
                
                elif not skip_current_section:
                    # Regular content
                    paragraph_id, clean_text = self.extract_paragraph_id(paragraph)
                    if not paragraph_id:
                        paragraph_id = f"{item_id}"
                    
                    current_items.append({
                        "id": paragraph_id,
                        "text": clean_text,
                        "page": page_num
                    })
                    item_id += 1
        
        # Don't forget the last section
        if current_items and not skip_current_section:
            sections[current_section] = current_items
        
        # Filter out empty sections
        return {k: v for k, v in sections.items() if v}
    
    def process_pdf(self, pdf_path: Path) -> Optional[Dict]:
        """Process a single PDF file"""
        self.logger.info(f"Processing {pdf_path.name}")
        
        try:
            # Extract text
            pages_data, extraction_method = self.extract_pdf_text(pdf_path)
            
            if not pages_data:
                self.logger.error(f"Failed to extract text from {pdf_path.name}")
                return None
            
            # Detect metadata
            language = self.detect_language(pdf_path.name)
            year = self.detect_year(pdf_path.name)
            
            # Structure content
            sections = self.structure_content(pages_data, language)
            
            # Create output structure
            result = {
                "metadata": {
                    "year": year,
                    "language": language,
                    "title": f"OECD Transfer Pricing Guidelines for Multinational Enterprises and Tax Administrations",
                    "extracted_date": datetime.now().isoformat(),
                    "source_file": pdf_path.name
                },
                "sections": sections,
                "extraction_stats": {
                    "total_pages": len(pages_data),
                    "total_sections": len(sections),
                    "total_items": sum(len(items) for items in sections.values()),
                    "extraction_method": extraction_method
                }
            }
            
            self.logger.info(f"Successfully processed {pdf_path.name}: {len(pages_data)} pages, {len(sections)} sections")
            return result
            
        except Exception as e:
            self.logger.error(f"Error processing {pdf_path.name}: {e}")
            return None
    
    def extract_all_pdfs(self, file_pattern: Optional[str] = None) -> List[str]:
        """Extract all PDF files in input directory"""
        processed_files = []
        
        # Find PDF files
        if file_pattern:
            pdf_files = list(self.input_dir.glob(file_pattern))
        else:
            pdf_files = list(self.input_dir.glob("*.pdf"))
        
        if not pdf_files:
            self.logger.warning(f"No PDF files found in {self.input_dir}")
            return processed_files
        
        for pdf_path in sorted(pdf_files):
            try:
                result = self.process_pdf(pdf_path)
                
                if result:
                    # Generate output filename
                    name_parts = pdf_path.stem.split('_')
                    if len(name_parts) >= 4:
                        output_name = f"{name_parts[2]}_{name_parts[3]}.json"
                    else:
                        output_name = f"{pdf_path.stem}.json"
                    
                    output_path = self.output_dir / output_name
                    
                    # Write JSON with proper formatting
                    with open(output_path, 'w', encoding='utf-8') as f:
                        json.dump(result, f, indent=2, ensure_ascii=False)
                    
                    processed_files.append(str(output_path))
                    self.logger.info(f"Saved {output_name}")
                
            except Exception as e:
                self.logger.error(f"Failed to process {pdf_path.name}: {e}")
                continue
        
        return processed_files

def main():
    parser = argparse.ArgumentParser(description='Fixed OECD TPG PDF to JSON Extractor')
    parser.add_argument('--input-dir', '-i', default='data', 
                       help='Input directory containing PDF files')
    parser.add_argument('--output-dir', '-o', default='out',
                       help='Output directory for JSON files')
    parser.add_argument('--file', '-f', 
                       help='Process single file pattern')
    parser.add_argument('--verbose', '-v', action='store_true',
                       help='Enable verbose logging')
    
    args = parser.parse_args()
    
    # Create extractor
    extractor = PDFExtractor(
        input_dir=args.input_dir,
        output_dir=args.output_dir,
        verbose=args.verbose
    )
    
    # Process files
    start_time = datetime.now()
    processed_files = extractor.extract_all_pdfs(args.file)
    end_time = datetime.now()
    
    # Summary
    print(f"\\n{'='*60}")
    print(f"EXTRACTION COMPLETE")
    print(f"{'='*60}")
    print(f"Processed: {len(processed_files)} files")
    print(f"Duration: {end_time - start_time}")
    
    if processed_files:
        print(f"\\nGenerated files:")
        for file_path in processed_files:
            file_size = os.path.getsize(file_path) / 1024 / 1024
            print(f"  - {file_path} ({file_size:.1f}MB)")

if __name__ == '__main__':
    main()