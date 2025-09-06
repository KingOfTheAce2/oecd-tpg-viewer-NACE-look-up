"""
PDF reading utilities for OECD TPG documents.
Provides line-by-line iteration with page number tracking.
"""
import re
from typing import Iterator, Tuple, Dict, Any
from pathlib import Path
import pdfplumber


class PDFLineIterator:
    """Iterator that yields lines from PDF with page numbers."""
    
    def __init__(self, pdf_path: Path):
        self.pdf_path = pdf_path
        self.pdf = None
        self.current_page = 0
        self.lines = []
        self.line_index = 0
        
    def __enter__(self):
        self.pdf = pdfplumber.open(str(self.pdf_path))
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.pdf:
            self.pdf.close()
    
    def __iter__(self):
        return self
    
    def __next__(self) -> Tuple[str, int]:
        """Returns (line_text, page_number) tuple."""
        if self.line_index >= len(self.lines):
            self._load_next_page()
        
        if self.line_index >= len(self.lines):
            raise StopIteration
        
        line_data = self.lines[self.line_index]
        self.line_index += 1
        return line_data  # line_data is already a (text, page_num) tuple
    
    def _load_next_page(self):
        """Load lines from the next page."""
        while self.current_page < len(self.pdf.pages):
            page = self.pdf.pages[self.current_page]
            text = page.extract_text() or ""
            
            # Split into lines and track page number
            page_lines = [(line.strip(), self.current_page + 1) 
                         for line in text.splitlines() 
                         if line.strip()]
            
            if page_lines:
                self.lines.extend(page_lines)
                self.current_page += 1
                return
            
            self.current_page += 1
        
        # No more pages with content
        self.lines = self.lines[self.line_index:]
        self.line_index = 0


def extract_pdf_lines_with_pages(pdf_path: Path) -> Iterator[Tuple[str, int]]:
    """
    Extract all lines from PDF with page numbers.
    
    Args:
        pdf_path: Path to PDF file
        
    Yields:
        Tuple of (line_text, page_number)
    """
    with PDFLineIterator(pdf_path) as iterator:
        for line, page_num in iterator:
            yield line, page_num


def get_pdf_metadata(pdf_path: Path) -> Dict[str, Any]:
    """
    Extract metadata from PDF file.
    
    Args:
        pdf_path: Path to PDF file
        
    Returns:
        Dictionary containing PDF metadata
    """
    metadata = {
        'file_path': str(pdf_path),
        'file_size': pdf_path.stat().st_size,
        'total_pages': 0,
        'title': None,
        'author': None,
        'creation_date': None
    }
    
    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            metadata['total_pages'] = len(pdf.pages)
            
            # Extract PDF metadata if available
            if hasattr(pdf, 'metadata') and pdf.metadata:
                metadata.update({
                    'title': pdf.metadata.get('Title'),
                    'author': pdf.metadata.get('Author'),
                    'creation_date': pdf.metadata.get('CreationDate')
                })
    except Exception as e:
        metadata['error'] = str(e)
    
    return metadata


def extract_text_blocks(pdf_path: Path) -> Iterator[Tuple[str, int, Dict]]:
    """
    Extract text blocks from PDF with additional formatting info.
    
    Args:
        pdf_path: Path to PDF file
        
    Yields:
        Tuple of (text_block, page_number, formatting_info)
    """
    with pdfplumber.open(str(pdf_path)) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            # Extract text with character-level details
            chars = page.chars
            if not chars:
                continue
            
            # Group characters into lines and blocks
            lines = []
            current_line = []
            last_y = None
            
            for char in chars:
                if last_y is None:
                    last_y = char['y0']
                
                # Check if we've moved to a new line (y coordinate changed significantly)
                if abs(char['y0'] - last_y) > 2:  # 2 point threshold for new line
                    if current_line:
                        line_text = ''.join(c['text'] for c in current_line)
                        if line_text.strip():
                            lines.append({
                                'text': line_text.strip(),
                                'y': last_y,
                                'font_size': current_line[0].get('size', 12),
                                'font_name': current_line[0].get('fontname', ''),
                            })
                    current_line = [char]
                    last_y = char['y0']
                else:
                    current_line.append(char)
            
            # Add final line
            if current_line:
                line_text = ''.join(c['text'] for c in current_line)
                if line_text.strip():
                    lines.append({
                        'text': line_text.strip(),
                        'y': last_y,
                        'font_size': current_line[0].get('size', 12),
                        'font_name': current_line[0].get('fontname', ''),
                    })
            
            # Yield lines grouped into logical blocks
            for line in lines:
                yield line['text'], page_num, {
                    'font_size': line['font_size'],
                    'font_name': line['font_name'],
                    'y_position': line['y']
                }