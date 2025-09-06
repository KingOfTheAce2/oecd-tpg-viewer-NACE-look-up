"""
Text processing utilities for OECD TPG documents.
Handles text normalization, section detection, and paragraph extraction.
"""
import re
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass


@dataclass
class TextLine:
    """Represents a line of text with metadata."""
    text: str
    page: int
    font_size: Optional[float] = None
    font_name: Optional[str] = None
    is_heading: bool = False
    heading_level: Optional[int] = None


class TextNormalizer:
    """Normalizes and cleans text from PDF extraction."""
    
    # Common patterns for cleaning
    HYPHEN_PATTERN = re.compile(r'(\w+)-\s*\n\s*(\w+)')
    MULTIPLE_SPACES = re.compile(r'\s+')
    LINE_BREAKS = re.compile(r'\n\s*\n\s*\n+')
    
    # Patterns for detecting structural elements
    PAGE_NUMBER_PATTERN = re.compile(r'^\s*\d+\s*$')
    HEADER_FOOTER_PATTERN = re.compile(r'^(OECD|Transfer Pricing|Guidelines|©|\d{4})', re.IGNORECASE)
    
    @classmethod
    def normalize_line(cls, line: str) -> str:
        """
        Normalize a single line of text.
        
        Args:
            line: Raw text line
            
        Returns:
            Normalized text
        """
        if not line:
            return ""
        
        # Remove excessive whitespace
        line = cls.MULTIPLE_SPACES.sub(' ', line)
        
        # Remove common OCR artifacts
        line = line.replace('�', '')
        line = line.replace('\x00', '')
        
        # Fix common encoding issues
        line = line.replace('\u2019', "'")  # Right single quotation mark
        line = line.replace('\u201c', '"')  # Left double quotation mark
        line = line.replace('\u201d', '"')  # Right double quotation mark
        line = line.replace('\u2013', '-')  # En dash
        line = line.replace('\u2014', '-')  # Em dash
        
        return line.strip()
    
    @classmethod
    def is_likely_header_footer(cls, line: str) -> bool:
        """
        Determine if a line is likely a header or footer.
        
        Args:
            line: Text line to check
            
        Returns:
            True if likely header/footer
        """
        if not line or len(line) < 3:
            return True
        
        # Check for page numbers
        if cls.PAGE_NUMBER_PATTERN.match(line):
            return True
        
        # Check for common header/footer patterns
        if cls.HEADER_FOOTER_PATTERN.match(line):
            return True
        
        # Very short lines are often headers/footers
        if len(line) < 10 and not any(c.isalpha() for c in line):
            return True
        
        return False
    
    @classmethod
    def join_hyphenated_words(cls, text: str) -> str:
        """
        Join words split by hyphens across line breaks.
        
        Args:
            text: Text with potential hyphenated line breaks
            
        Returns:
            Text with hyphenated words rejoined
        """
        return cls.HYPHEN_PATTERN.sub(r'\1\2', text)
    
    @classmethod
    def normalize_paragraph_text(cls, lines: List[str]) -> str:
        """
        Normalize multiple lines into clean paragraph text.
        
        Args:
            lines: List of text lines
            
        Returns:
            Normalized paragraph text
        """
        if not lines:
            return ""
        
        # Join lines and normalize
        text = ' '.join(line.strip() for line in lines if line.strip())
        text = cls.normalize_line(text)
        text = cls.join_hyphenated_words(text)
        
        # Clean up multiple line breaks
        text = cls.LINE_BREAKS.sub('\n\n', text)
        
        return text.strip()


class SectionDetector:
    """Detects document sections and headings."""
    
    # Patterns for detecting different types of sections
    CHAPTER_PATTERN = re.compile(r'^(Chapter|CHAPTER)\s+([IVX]+|\d+)[:\.]?\s*(.*)$', re.IGNORECASE)
    PREFACE_PATTERN = re.compile(r'^(Preface|PREFACE|Foreword|FOREWORD)$', re.IGNORECASE)
    ANNEX_PATTERN = re.compile(r'^(Annex|ANNEX)\s+([A-Z]+|\d+)[:\.]?\s*(.*)$', re.IGNORECASE)
    SECTION_PATTERN = re.compile(r'^(\d+)\.\s*(.+)$')
    SUBSECTION_PATTERN = re.compile(r'^(\d+\.\d+)\s*(.+)$')
    
    # Patterns for detecting paragraph numbering
    PARAGRAPH_PATTERN = re.compile(r'^(\d+\.\d+\.?\d*)\s+(.*)$')
    
    @classmethod
    def detect_heading_type(cls, line: str, font_info: Optional[Dict] = None) -> Tuple[Optional[str], Optional[int]]:
        """
        Detect if a line is a heading and what type.
        
        Args:
            line: Text line to analyze
            font_info: Optional font information
            
        Returns:
            Tuple of (heading_type, level) or (None, None)
        """
        if not line:
            return None, None
        
        line = line.strip()
        
        # Check for preface
        if cls.PREFACE_PATTERN.match(line):
            return 'preface', 1
        
        # Check for chapters
        chapter_match = cls.CHAPTER_PATTERN.match(line)
        if chapter_match:
            return 'chapter', 1
        
        # Check for annexes
        annex_match = cls.ANNEX_PATTERN.match(line)
        if annex_match:
            return 'annex', 1
        
        # Check for numbered sections
        section_match = cls.SECTION_PATTERN.match(line)
        if section_match:
            return 'section', 2
        
        # Use font information if available
        if font_info:
            font_size = font_info.get('font_size', 12)
            if font_size > 14:  # Larger fonts often indicate headings
                return 'heading', 2
        
        return None, None
    
    @classmethod
    def is_paragraph_start(cls, line: str) -> Optional[str]:
        """
        Check if line starts a numbered paragraph.
        
        Args:
            line: Text line to check
            
        Returns:
            Paragraph number if found, None otherwise
        """
        match = cls.PARAGRAPH_PATTERN.match(line.strip())
        if match:
            return match.group(1)
        return None
    
    @classmethod
    def extract_section_title(cls, line: str) -> str:
        """
        Extract clean section title from a heading line.
        
        Args:
            line: Heading line
            
        Returns:
            Clean section title
        """
        line = line.strip()
        
        # Remove common prefixes
        for pattern in [cls.CHAPTER_PATTERN, cls.ANNEX_PATTERN, cls.SECTION_PATTERN]:
            match = pattern.match(line)
            if match:
                if len(match.groups()) >= 3:
                    return match.group(3).strip()
                elif len(match.groups()) >= 2:
                    return match.group(2).strip()
        
        # For preface, just return as is
        if cls.PREFACE_PATTERN.match(line):
            return line.title()
        
        return line


class DocumentReader:
    """High-level document reader that combines PDF reading with text processing."""
    
    def __init__(self, normalizer: Optional[TextNormalizer] = None):
        self.normalizer = normalizer or TextNormalizer()
    
    def read_document_lines(self, pdf_path) -> List[TextLine]:
        """
        Read document and return structured lines.
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            List of TextLine objects
        """
        from readers_pdf import extract_text_blocks
        
        lines = []
        for text, page_num, format_info in extract_text_blocks(pdf_path):
            normalized_text = self.normalizer.normalize_line(text)
            
            # Skip likely headers/footers
            if self.normalizer.is_likely_header_footer(normalized_text):
                continue
            
            # Detect if this is a heading
            heading_type, level = SectionDetector.detect_heading_type(
                normalized_text, format_info
            )
            
            line = TextLine(
                text=normalized_text,
                page=page_num,
                font_size=format_info.get('font_size'),
                font_name=format_info.get('font_name'),
                is_heading=heading_type is not None,
                heading_level=level
            )
            
            lines.append(line)
        
        return lines