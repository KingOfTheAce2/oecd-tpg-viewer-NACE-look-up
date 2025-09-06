"""
OECD Transfer Pricing Guidelines parser.
Main parser that combines PDF reading with text processing to extract structured data.
"""
import re
from typing import Dict, List, Optional, Any
from pathlib import Path
from dataclasses import dataclass, field
import logging

from readers_pdf import PDFLineIterator, get_pdf_metadata
from readers_text import TextNormalizer, SectionDetector, DocumentReader


@dataclass
class TPGParagraph:
    """Represents a single TPG paragraph."""
    id: str
    text: str
    page: int
    section: Optional[str] = None
    

@dataclass
class TPGSection:
    """Represents a TPG section containing paragraphs."""
    title: str
    paragraphs: List[TPGParagraph] = field(default_factory=list)
    subsections: Dict[str, 'TPGSection'] = field(default_factory=dict)
    page: Optional[int] = None


class TPGParser:
    """Main parser for OECD TPG documents."""
    
    def __init__(self):
        self.normalizer = TextNormalizer()
        self.section_detector = SectionDetector()
        self.doc_reader = DocumentReader(self.normalizer)
        
        # Paragraph numbering pattern (e.g., 1.43, 2.15.1)
        self.paragraph_pattern = re.compile(r'^(\d+\.\d+(?:\.\d+)*)\s+(.*)$')
        
        # Enhanced section patterns
        self.preface_pattern = re.compile(r'^(Preface|PREFACE|Foreword|FOREWORD)\s*$', re.IGNORECASE)
        self.chapter_pattern = re.compile(r'^(Chapter|CHAPTER)\s+([IVX]+|\d+)[:\.]?\s*(.*)$', re.IGNORECASE)
        self.annex_pattern = re.compile(r'^(Annex|ANNEX)\s+([A-Z]+|\d+)[:\.]?\s*(.*)$', re.IGNORECASE)
    
    def parse_document(self, pdf_path: Path) -> Dict[str, TPGSection]:
        """
        Parse a TPG PDF document into structured sections.
        
        Args:
            pdf_path: Path to the PDF file
            
        Returns:
            Dictionary mapping section names to TPGSection objects
        """
        logging.info(f"Parsing document: {pdf_path}")
        
        sections = {}
        current_section = None
        current_paragraph = None
        buffer_lines = []
        
        try:
            with PDFLineIterator(pdf_path) as pdf_iterator:
                for line, page_num in pdf_iterator:
                    line = self.normalizer.normalize_line(line)
                    
                    if not line or self.normalizer.is_likely_header_footer(line):
                        continue
                    
                    # Check if this line starts a new section
                    section_info = self._detect_section(line)
                    if section_info:
                        # Finalize current paragraph if exists
                        if current_paragraph and buffer_lines:
                            current_paragraph.text = self._finalize_paragraph_text(buffer_lines)
                            buffer_lines = []
                        
                        # Create new section
                        section_title, section_key = section_info
                        current_section = TPGSection(title=section_title, page=page_num)
                        sections[section_key] = current_section
                        current_paragraph = None
                        
                        logging.debug(f"Found section: {section_title} at page {page_num}")
                        continue
                    
                    # Check if this line starts a new paragraph
                    para_match = self.paragraph_pattern.match(line)
                    if para_match:
                        # Finalize previous paragraph
                        if current_paragraph and buffer_lines:
                            current_paragraph.text = self._finalize_paragraph_text(buffer_lines)
                            buffer_lines = []
                        
                        # Start new paragraph
                        para_id = para_match.group(1)
                        para_text_start = para_match.group(2)
                        
                        current_paragraph = TPGParagraph(
                            id=para_id,
                            text="",
                            page=page_num,
                            section=current_section.title if current_section else None
                        )
                        
                        # Add to current section
                        if current_section:
                            current_section.paragraphs.append(current_paragraph)
                        
                        # Start collecting paragraph text
                        buffer_lines = [para_text_start] if para_text_start.strip() else []
                        
                        logging.debug(f"Found paragraph: {para_id} at page {page_num}")
                        continue
                    
                    # This is a continuation line
                    if current_paragraph is not None:
                        buffer_lines.append(line)
                
                # Finalize last paragraph
                if current_paragraph and buffer_lines:
                    current_paragraph.text = self._finalize_paragraph_text(buffer_lines)
        
        except Exception as e:
            logging.error(f"Error parsing document {pdf_path}: {e}")
            raise
        
        logging.info(f"Parsed {len(sections)} sections from {pdf_path}")
        return sections
    
    def _detect_section(self, line: str) -> Optional[tuple[str, str]]:
        """
        Detect if a line represents a section heading.
        
        Args:
            line: Text line to check
            
        Returns:
            Tuple of (section_title, section_key) or None
        """
        line = line.strip()
        
        # Check for Preface
        if self.preface_pattern.match(line):
            return "Preface", "Preface"
        
        # Check for Chapters
        chapter_match = self.chapter_pattern.match(line)
        if chapter_match:
            chapter_num = chapter_match.group(2)
            chapter_title = chapter_match.group(3) if chapter_match.group(3) else f"Chapter {chapter_num}"
            return chapter_title.strip(), f"Chapter {chapter_num}"
        
        # Check for Annexes
        annex_match = self.annex_pattern.match(line)
        if annex_match:
            annex_id = annex_match.group(2)
            annex_title = annex_match.group(3) if annex_match.group(3) else f"Annex {annex_id}"
            return annex_title.strip(), f"Annex {annex_id}"
        
        # Check for numbered sections (like "1. Introduction") 
        numbered_section = re.match(r'^(\d+)\.\s*(.+)$', line)
        if numbered_section and len(numbered_section.group(2)) > 5:
            section_num = numbered_section.group(1)
            section_title = numbered_section.group(2)
            return section_title.strip(), f"Section {section_num}"
        
        return None
    
    def _finalize_paragraph_text(self, lines: List[str]) -> str:
        """
        Finalize paragraph text from collected lines.
        
        Args:
            lines: List of text lines
            
        Returns:
            Final paragraph text
        """
        return self.normalizer.normalize_paragraph_text(lines)
    
    def to_dict(self, sections: Dict[str, TPGSection]) -> Dict[str, Any]:
        """
        Convert parsed sections to dictionary format.
        
        Args:
            sections: Dictionary of TPGSection objects
            
        Returns:
            Dictionary representation
        """
        result = {}
        
        for section_key, section in sections.items():
            section_data = {
                section.title: []
            }
            
            for paragraph in section.paragraphs:
                para_dict = {
                    "id": paragraph.id,
                    "text": paragraph.text,
                    "page": paragraph.page
                }
                section_data[section.title].append(para_dict)
            
            # Handle subsections if any
            for sub_key, subsection in section.subsections.items():
                sub_data = []
                for paragraph in subsection.paragraphs:
                    para_dict = {
                        "id": paragraph.id,
                        "text": paragraph.text,
                        "page": paragraph.page
                    }
                    sub_data.append(para_dict)
                section_data[subsection.title] = sub_data
            
            result.update(section_data)
        
        return result


def extract_oecd_tpg_to_json(pdf_path: Path, language: str = "EN", year: str = "2022") -> Dict[str, Any]:
    """
    Main function to extract OECD TPG data to JSON format.
    This is the high-level API function referenced in the requirements.
    
    Args:
        pdf_path: Path to PDF file
        language: Language code (e.g., "EN", "DE", "FR")
        year: Year string (e.g., "2022")
        
    Returns:
        Dictionary with extracted TPG data
    """
    parser = TPGParser()
    sections = parser.parse_document(pdf_path)
    
    # Convert to the required format
    result = parser.to_dict(sections)
    
    # Add metadata
    metadata = get_pdf_metadata(pdf_path)
    result_with_meta = {
        "metadata": {
            "source_file": str(pdf_path),
            "language": language,
            "year": year,
            "total_sections": len(sections),
            "total_paragraphs": sum(len(s.paragraphs) for s in sections.values()),
            "pdf_metadata": metadata
        },
        "sections": result
    }
    
    return result_with_meta


# Example runner functions for compatibility
class TPG_2022_EN:
    """Example runner class for 2022 English TPG."""
    
    @staticmethod
    def extract(pdf_path: Path) -> Dict[str, Any]:
        return extract_oecd_tpg_to_json(pdf_path, "EN", "2022")


def run_parser():
    """Example runner function."""
    # This would be implemented to match existing patterns
    # For now, it's a placeholder that shows the expected interface
    pass


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)