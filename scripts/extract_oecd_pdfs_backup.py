#!/usr/bin/env python3
"""
OECD Transfer Pricing Guidelines PDF to JSON Extractor

Extracts OECD TPG PDFs from /data folder into structured JSON format.
Supports multiple languages and years with intelligent section detection.
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

# OECD-specific patterns for cleaning and paragraph detection
OECD_PATTERNS = {
    'copyright_footer': r'DIRECTRICES DE LA OCDE.*?© OCDE \d{4}',
    'copyright_footer_en': r'OECD TRANSFER PRICING GUIDELINES.*?© OECD \d{4}',
    'copyright_footer_fr': r'PRINCIPES DE L.OCDE.*?© OCDE \d{4}',
    'copyright_footer_de': r'OECD.*?© OECD \d{4}',
    'paragraph_number': r'^(\d+\.\d*\.?)\s*\t?\n?',
    'sub_paragraph': r'^([a-z]\)|\([a-z]\)|[ivx]+\)|\([ivx]+\))\s*',
    'page_number': r'^\d+\s*$',
    'header_footer': r'^[A-Z\s\u2013-]+\s*\u2013\s*\d+$',
    'page_header_es': r'^\d+\s*–\s*[A-ZÁÉÍÓÚÜ\s]+$',
    'page_header_en': r'^\d+\s*–\s*[A-Z\s]+$',
    'page_header_fr': r'^\d+\s*–\s*[A-ZÀÁÂÄÉÈÊËÍÌÎÏÓÒÔÖÚÙÛÜ\s]+$',
}

# Language-specific section patterns
SECTION_PATTERNS = {
    'EN': {
        'preface': r'(?i)^(preface|foreword|introduction)$',
        'chapter': r'(?i)^chapter\s+(\d+|[ivx]+)',
        'appendix': r'(?i)^appendix\s+([a-z]|\d+)',
        'annex': r'(?i)^annex\s+([a-z]|\d+)',
        'glossary': r'(?i)^(glossary|definitions)$',
        'bibliography': r'(?i)^bibliography$',
        'table_of_contents': r'(?i)^(table\s+of\s+contents?|contents?)$',
        'list_of_annexes': r'(?i)^(list\s+of\s+annexes?)$'
    },
    'DE': {
        'preface': r'(?i)^(vorwort|einleitung)$',
        'chapter': r'(?i)^kapitel\s+(\d+|[ivx]+)',
        'appendix': r'(?i)^anhang\s+([a-z]|\d+)',
        'annex': r'(?i)^anlage\s+([a-z]|\d+)',
        'glossary': r'(?i)^(glossar|definitionen)$',
        'bibliography': r'(?i)^literaturverzeichnis$',
        'table_of_contents': r'(?i)^(inhaltsverzeichnis)$',
        'list_of_annexes': r'(?i)^(liste\s+der\s+anhänge?)$'
    },
    'ES': {
        'preface': r'(?i)^(prefacio|prólogo|introducción)$',
        'chapter': r'(?i)^capítulo\s+(\d+|[ivx]+)',
        'appendix': r'(?i)^apéndice\s+([a-z]|\d+)',
        'annex': r'(?i)^anexo\s+([a-z]|\d+)',
        'glossary': r'(?i)^(glosario|definiciones)$',
        'bibliography': r'(?i)^bibliografía$',
        'table_of_contents': r'(?i)^(tabla\s+de\s+contenidos?|\u00edndice)$',
        'list_of_annexes': r'(?i)^(lista\s+de\s+anexos?)$'
    },
    'FR': {
        'preface': r'(?i)^(préface|avant-propos|introduction)$',
        'chapter': r'(?i)^chapitre\s+(\d+|[ivx]+)',
        'appendix': r'(?i)^appendice\s+([a-z]|\d+)',
        'annex': r'(?i)^annexe\s+([a-z]|\d+)',
        'glossary': r'(?i)^(glossaire|définitions)$',
        'bibliography': r'(?i)^bibliographie$',
        'table_of_contents': r'(?i)^(table\s+des\s+matières)$',
        'list_of_annexes': r'(?i)^(liste\s+des\s+annexes?)$'
    },
    'CZ': {
        'preface': r'(?i)^(předmluva|úvod)$',
        'chapter': r'(?i)^kapitola\s+(\d+|[ivx]+)',
        'appendix': r'(?i)^příloha\s+([a-z]|\d+)',
        'glossary': r'(?i)^(slovník|definice)$'
    },
    'JP': {
        'preface': r'(?i)^(序文|はじめに|前書き)$',
        'chapter': r'(?i)^第\s*(\d+|[一二三四五六七八九十]+)\s*章',
        'appendix': r'(?i)^付録\s*([a-z]|\d+)',
        'glossary': r'(?i)^(用語集|定義)$'
    }
}

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
    
    def extract_pdf_with_pymupdf(self, pdf_path: Path) -> List[Dict]:
        """Extract text using PyMuPDF (fitz)"""
        if not PYMUPDF_AVAILABLE:
            return []
        
        try:
            doc = fitz.open(str(pdf_path))
            pages_data = []
            
            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text()
                
                if text.strip():
                    pages_data.append({
                        'page': page_num + 1,
                        'text': text.strip()
                    })
            
            doc.close()
            return pages_data
            
        except Exception as e:
            self.logger.error(f"PyMuPDF extraction failed for {pdf_path}: {e}")
            return []
    
    def extract_pdf_with_pdfplumber(self, pdf_path: Path) -> List[Dict]:
        """Extract text using pdfplumber"""
        if not PDFPLUMBER_AVAILABLE:
            return []
        
        try:
            pages_data = []
            
            with pdfplumber.open(str(pdf_path)) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    text = page.extract_text()
                    
                    if text and text.strip():
                        pages_data.append({
                            'page': page_num + 1,
                            'text': text.strip()
                        })
            
            return pages_data
            
        except Exception as e:
            self.logger.error(f"pdfplumber extraction failed for {pdf_path}: {e}")
            return []
    
    def extract_pdf_text(self, pdf_path: Path) -> Tuple[List[Dict], str]:
        """Extract text from PDF using available libraries"""
        extraction_method = "None"
        pages_data = []
        
        # Try PyMuPDF first (generally faster and more reliable)
        if PYMUPDF_AVAILABLE:
            pages_data = self.extract_pdf_with_pymupdf(pdf_path)
            if pages_data:
                extraction_method = "PyMuPDF"
        
        # Fallback to pdfplumber
        if not pages_data and PDFPLUMBER_AVAILABLE:
            pages_data = self.extract_pdf_with_pdfplumber(pdf_path)
            if pages_data:
                extraction_method = "pdfplumber"
        
        return pages_data, extraction_method
    
    def detect_language(self, filename: str) -> str:
        """Detect language from filename"""
        # Extract language code from filename (e.g., OECD_TPG_EN_2022.pdf -> EN)
        match = re.search(r'_([A-Z]{2})_', filename.upper())
        if match:
            return match.group(1)
        
        # Fallback to common patterns
        filename_upper = filename.upper()
        if '_EN_' in filename_upper or '_ENGLISH_' in filename_upper:
            return 'EN'
        elif '_DE_' in filename_upper or '_GERMAN_' in filename_upper:
            return 'DE'
        elif '_ES_' in filename_upper or '_SPANISH_' in filename_upper:
            return 'ES'
        elif '_FR_' in filename_upper or '_FRENCH_' in filename_upper:
            return 'FR'
        elif '_CZ_' in filename_upper:
            return 'CZ'
        elif '_JP_' in filename_upper:
            return 'JP'
        
        return 'EN'  # Default to English
    
    def detect_year(self, filename: str) -> Optional[int]:
        """Detect year from filename"""
        match = re.search(r'(\d{4})', filename)
        if match:
            year = int(match.group(1))
            if 2000 <= year <= 2030:  # Reasonable year range
                return year
        return None
    
    def identify_section(self, text: str, language: str) -> Tuple[str, str]:
        """Identify section type and normalize name"""
        text = text.strip()
        patterns = SECTION_PATTERNS.get(language, SECTION_PATTERNS['EN'])
        
        for section_type, pattern in patterns.items():
            if re.match(pattern, text):
                # Normalize section name
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
    
    def clean_text(self, text: str) -> str:
        """Clean text by removing OECD copyright footers, normalizing whitespace, and fixing formatting"""
        if not text:
            return ""
        
        # Remove OECD copyright footers using language-specific patterns
        for pattern_name in ['copyright_footer', 'copyright_footer_en', 'copyright_footer_fr', 'copyright_footer_de']:
            text = re.sub(OECD_PATTERNS[pattern_name], '', text, flags=re.MULTILINE | re.IGNORECASE)
        
        # Remove additional copyright patterns
        copyright_patterns = [
            r'©\s*OECD.*?(?=\n|$)',
            r'© OCDE.*?(?=\n|$)',
            r'Copyright.*?OECD.*?(?=\n|$)',
            r'All rights reserved.*?(?=\n|$)',
            r'No reproduction.*?permission.*?(?=\n|$)',
            r'www\.oecd\.org.*?(?=\n|$)',
            r'OECD PUBLISHING.*?(?=\n|$)',
            r'ISBN\s*\d+.*?(?=\n|$)',
            r'DOI:\s*\d+.*?(?=\n|$)',
            r'– © OCDE \d{4}',
            r'– © OECD \d{4}',
        ]
        
        for pattern in copyright_patterns:
            text = re.sub(pattern, '', text, flags=re.IGNORECASE | re.MULTILINE)
        
        # Clean up formatting artifacts
        # Remove excessive whitespace
        text = re.sub(r'\n\s*\n\s*\n+', '\n\n', text)
        text = re.sub(r'[ \t]+', ' ', text)
        
        # Remove page numbers and headers/footers
        lines = text.split('\n')
        cleaned_lines = []
        
        for line in lines:
            line = line.strip()
            # Skip empty lines, page numbers, headers/footers, and copyright remnants
            if (not line or 
                re.match(OECD_PATTERNS['page_number'], line) or
                re.match(OECD_PATTERNS['header_footer'], line) or
                re.match(OECD_PATTERNS['page_header_es'], line) or
                re.match(OECD_PATTERNS['page_header_en'], line) or
                re.match(OECD_PATTERNS['page_header_fr'], line) or
                len(line) < 3):
                continue
            cleaned_lines.append(line)
        
        # Rejoin and normalize whitespace but preserve paragraph structure
        result = '\n'.join(cleaned_lines)
        
        # Fix common formatting issues
        result = re.sub(r'\s+', ' ', result)  # Multiple spaces to single space
        result = re.sub(r'\t+', ' ', result)  # Tabs to spaces
        result = result.strip()
        
        return result
    
    def extract_paragraph_id(self, text: str) -> Tuple[Optional[str], str]:
        """Extract OECD paragraph ID from text and return (id, remaining_text)"""
        # Look for paragraph numbers like "1.3.", "2.15.", etc.
        match = re.match(OECD_PATTERNS['paragraph_number'], text)
        if match:
            paragraph_id = match.group(1).rstrip('.')
            remaining_text = text[match.end():].strip()
            return paragraph_id, remaining_text
        
        # Look for sub-paragraph markers like "a)", "(i)", etc.
        match = re.match(OECD_PATTERNS['sub_paragraph'], text)
        if match:
            sub_id = match.group(1)
            remaining_text = text[match.end():].strip()
            return sub_id, remaining_text
        
        return None, text
    
    def should_skip_section(self, section_name: str, section_type: str) -> bool:
        """Determine if a section should be skipped based on OECD structure"""
        skip_sections = {'table_of_contents', 'list_of_annexes', 'glossary', 'bibliography'}
        return section_type in skip_sections
    
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
                
            # Check if this looks like a continuation of the previous paragraph
            # (starts with lowercase, or is very short, or starts with certain connectors)
            is_continuation = (
                current_paragraph and 
                (paragraph[0].islower() or 
                 len(paragraph) < 50 or
                 paragraph.startswith(('and', 'or', 'but', 'however', 'therefore', 'thus', 'in', 'on', 'for', 'with', 'by')))
            )
            
            if is_continuation:
                current_paragraph += " " + paragraph
            else:
                if current_paragraph:
                    merged.append(current_paragraph)
                current_paragraph = paragraph
        
        # Don't forget the last paragraph
        if current_paragraph:
            merged.append(current_paragraph)
            
        return merged
    
    
    def generate_oecd_paragraph_id(self, section_name: str, item_index: int, content: str) -> str:
        """Generate OECD-style paragraph IDs using proper OECD numbering"""
        # First, look for existing OECD paragraph numbers in the content
        paragraph_id, remaining_text = self.extract_paragraph_id(content)
        if paragraph_id:
            return paragraph_id
        
        # Extract chapter/section number if available
        section_number = ""
        if "Chapter_" in section_name:
            match = re.search(r'Chapter_([\d\.]+)', section_name)
            if match:
                section_number = match.group(1)
        elif "Appendix_" in section_name:
            match = re.search(r'Appendix_([A-Z])', section_name)
            if match:
                section_number = match.group(1)
        elif "Annex_" in section_name:
            match = re.search(r'Annex_([A-Z])', section_name)
            if match:
                section_number = match.group(1)
        
        # Generate structured ID following OECD convention
        if section_number:
            return f"{section_number}.{item_index}"
        else:
            return str(item_index)
    
    def merge_fragmented_text(self, paragraphs: List[str]) -> List[str]:
        """Merge fragmented text pieces into proper paragraphs"""
        if not paragraphs:
            return paragraphs
        
        merged = []
        current_paragraph = ""
        
        for paragraph in paragraphs:
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            
            # Check if this looks like a continuation
            is_continuation = (
                len(paragraph) < 100 and
                not paragraph.endswith('.') and
                not paragraph.endswith(':') and
                not paragraph.endswith(';') and
                not re.match(r'^\d+\.', paragraph) and  # Not a numbered list
                not re.match(r'^[A-Z][a-z]+\s+\d+', paragraph)  # Not a chapter/section header
            )
            
            if current_paragraph and is_continuation:
                # Merge with previous paragraph
                current_paragraph += " " + paragraph
            else:
                # Start new paragraph
                if current_paragraph:
                    merged.append(current_paragraph)
                current_paragraph = paragraph
        
        # Don't forget the last paragraph
        if current_paragraph:
            merged.append(current_paragraph)
        
        return merged
    
    def should_exclude_content(self, text: str) -> bool:
        """Determine if content should be excluded"""
        text_lower = text.lower()
        
        # Exclude table of contents
        if any(phrase in text_lower for phrase in [
            'table of contents', 'contents', 'índice', 'sommaire', 'inhaltsverzeichnis'
        ]):
            return True
        
        # Exclude index pages
        if any(phrase in text_lower for phrase in [
            'index', 'índice alfabético', 'stichwortverzeichnis'
        ]):
            return True
        
        # Exclude pure copyright/ISBN pages
        if len(text) < 200 and any(phrase in text_lower for phrase in [
            'isbn', 'copyright', 'all rights reserved', '© oecd'
        ]):
            return True
        
        return False
    
    def structure_content(self, pages_data: List[Dict], language: str) -> Dict:
        """Structure extracted content into sections with improved cleaning"""
        sections = {}
        current_section = "Preface"
        current_items = []
        item_id = 1
        
        for page_data in pages_data:
            page_num = page_data['page']
            text = page_data['text']
            
            # Clean the text first
            cleaned_text = self.clean_text(text)
            
            if not cleaned_text or self.should_exclude_content(cleaned_text):
                continue
            
            # Split into paragraphs and merge fragmented text
            initial_paragraphs = [p.strip() for p in cleaned_text.split('\n\n') if p.strip()]
            paragraphs = self.merge_fragmented_text(initial_paragraphs)
            
            for paragraph in paragraphs:
                # Skip very short paragraphs (likely artifacts)
                if len(paragraph) < 20:
                    continue
                
                # Check if this looks like a section header
                lines = paragraph.split('\n')
                first_line = lines[0].strip()
                
                section_name, section_type = self.identify_section(first_line, language)
                
                if section_name:
                    # Save previous section if not skipped
                    if current_items and not self.should_skip_section(current_section, ""):
                        sections[current_section] = current_items
                    
                    # Start new section
                    current_section = section_name
                    current_items = []
                    item_id = 1
                    
                    # Skip certain sections completely
                    if self.should_skip_section(section_name, section_type):
                        continue
                    
                    # Add remaining content of paragraph if any
                    if len(lines) > 1:
                        remaining_text = '\n'.join(lines[1:]).strip()
                        if remaining_text and len(remaining_text) > 20:
                            oecd_id = self.generate_oecd_paragraph_id(current_section, item_id, remaining_text)
                            current_items.append({
                                "id": oecd_id,
                                "text": remaining_text,
                                "page": page_num
                            })
                            item_id += 1
                else:
                    # Regular content - use OECD-style ID, but only if not in a skipped section
                    if not self.should_skip_section(current_section, ""):
                        oecd_id = self.generate_oecd_paragraph_id(current_section, item_id, paragraph)
                        current_items.append({
                            "id": oecd_id,
                            "text": paragraph,
                            "page": page_num
                        })
                        item_id += 1
        
        # Don't forget the last section if not skipped
        if current_items and not self.should_skip_section(current_section, ""):
            sections[current_section] = current_items
        
        return sections
    
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
                    "extraction_method": extraction_method,
                    "extraction_timestamp": datetime.now().isoformat()
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
        
        self.logger.info(f"Found {len(pdf_files)} PDF files to process")
        
        for pdf_path in sorted(pdf_files):
            try:
                result = self.process_pdf(pdf_path)
                
                if result:
                    # Generate output filename
                    name_parts = pdf_path.stem.split('_')
                    if len(name_parts) >= 4:  # OECD_TPG_LANG_YEAR
                        output_name = f"{name_parts[2]}_{name_parts[3]}.json"
                    else:
                        output_name = f"{pdf_path.stem}.json"
                    
                    output_path = self.output_dir / output_name
                    
                    # Write JSON
                    with open(output_path, 'w', encoding='utf-8') as f:
                        json.dump(result, f, indent=2, ensure_ascii=False)
                    
                    processed_files.append(str(output_path))
                    self.logger.info(f"Saved {output_name}")
                
            except Exception as e:
                self.logger.error(f"Failed to process {pdf_path.name}: {e}")
                continue
        
        return processed_files

def main():
    parser = argparse.ArgumentParser(description='Extract OECD TPG PDFs to JSON')
    parser.add_argument('--input-dir', '-i', default='data', 
                       help='Input directory containing PDF files (default: data)')
    parser.add_argument('--output-dir', '-o', default='out',
                       help='Output directory for JSON files (default: out)')
    parser.add_argument('--file', '-f', 
                       help='Process single file (e.g., OECD_TPG_EN_2022.pdf)')
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
    if args.file:
        file_pattern = args.file
    else:
        file_pattern = None
    
    start_time = datetime.now()
    processed_files = extractor.extract_all_pdfs(file_pattern)
    end_time = datetime.now()
    
    # Summary
    print(f"\n{'='*60}")
    print(f"EXTRACTION COMPLETE")
    print(f"{'='*60}")
    print(f"Processed: {len(processed_files)} files")
    print(f"Duration: {end_time - start_time}")
    print(f"Output directory: {args.output_dir}")
    
    if processed_files:
        print(f"\nGenerated files:")
        for file_path in processed_files:
            file_size = os.path.getsize(file_path) / 1024 / 1024  # MB
            print(f"  - {file_path} ({file_size:.1f}MB)")

if __name__ == '__main__':
    main()