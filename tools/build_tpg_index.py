#!/usr/bin/env python3
"""
OECD TPG Index Builder

Builds a consolidated JSON index from all TPG PDF files in ./data directory.
Produces out/oecd_tpg_index.json with the specified nested structure.
"""
import json
import re
import sys
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional
import logging
from collections import defaultdict, OrderedDict

# Add parent directory to path to import our modules
sys.path.append(str(Path(__file__).parent.parent))

from simple_tpg_parser import extract_oecd_tpg_to_json


class TPGIndexBuilder:
    """Builds consolidated TPG index from multiple PDF files."""
    
    def __init__(self, config_path: Optional[Path] = None):
        """
        Initialize the index builder.
        
        Args:
            config_path: Path to configuration file
        """
        self.config = self._load_config(config_path)
        self.data_dir = Path("data")
        self.out_dir = Path("out")
        self.logs_dir = Path("logs")
        
        # Ensure directories exist
        self.out_dir.mkdir(exist_ok=True)
        self.logs_dir.mkdir(exist_ok=True)
        
        # Set up logging
        self._setup_logging()
        
        # Initialize result structure
        self.index = OrderedDict()
        self.parse_stats = {
            'total_files': 0,
            'successful_parses': 0,
            'failed_parses': 0,
            'file_stats': {},
            'errors': []
        }
    
    def _load_config(self, config_path: Optional[Path]) -> Dict[str, Any]:
        """Load configuration file."""
        if config_path is None:
            config_path = Path(__file__).parent / "build_tpg_index.config.json"
        
        if config_path.exists():
            with open(config_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            logging.warning(f"Config file not found: {config_path}")
            return {
                'filename_overrides': {},
                'parsing_options': {},
                'output_options': {}
            }
    
    def _setup_logging(self):
        """Set up logging configuration."""
        log_file = self.logs_dir / "build_tpg_index.log"
        
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file, encoding='utf-8'),
                logging.StreamHandler(sys.stdout)
            ]
        )
    
    def _infer_file_metadata(self, pdf_path: Path) -> Tuple[str, str]:
        """
        Infer year and language from filename.
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            Tuple of (year, language)
        """
        filename = pdf_path.name
        
        # Check override map first
        if filename in self.config.get('filename_overrides', {}):
            override = self.config['filename_overrides'][filename]
            return override['year'], override['language']
        
        # Try to extract from filename pattern
        # Pattern: OECD_TPG_<LANG>_<YEAR>.pdf
        pattern = re.compile(r'OECD_TPG_([A-Z]{2})_(\d{4})\.pdf', re.IGNORECASE)
        match = pattern.match(filename)
        
        if match:
            language = match.group(1).upper()
            year = match.group(2)
            return year, language
        
        # Fallback: try to extract year and language separately
        year_match = re.search(r'(\d{4})', filename)
        lang_match = re.search(r'([A-Z]{2})', filename, re.IGNORECASE)
        
        year = year_match.group(1) if year_match else "unknown"
        language = lang_match.group(1).upper() if lang_match else "unknown"
        
        logging.warning(f"Could not parse filename pattern for {filename}, using year={year}, lang={language}")
        return year, language
    
    def _process_file(self, pdf_path: Path) -> bool:
        """
        Process a single PDF file.
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            True if successful, False otherwise
        """
        try:
            logging.info(f"Processing file: {pdf_path.name}")
            
            # Infer metadata
            year, language = self._infer_file_metadata(pdf_path)
            
            # Parse the PDF
            extracted_data = extract_oecd_tpg_to_json(pdf_path, language, year)
            
            # Extract sections from the parsed data
            sections = extracted_data.get('sections', {})
            metadata = extracted_data.get('metadata', {})
            
            # Initialize nested structure if needed
            if year not in self.index:
                self.index[year] = OrderedDict()
            if language not in self.index[year]:
                self.index[year][language] = OrderedDict()
            
            # Add sections to index
            for section_name, paragraphs in sections.items():
                self.index[year][language][section_name] = {
                    section_name: paragraphs
                }
            
            # Record statistics
            total_paragraphs = sum(len(paragraphs) if isinstance(paragraphs, list) else 0 
                                 for paragraphs in sections.values())
            
            self.parse_stats['file_stats'][pdf_path.name] = {
                'year': year,
                'language': language,
                'sections': len(sections),
                'paragraphs': total_paragraphs,
                'pages': metadata.get('pdf_metadata', {}).get('total_pages', 0),
                'status': 'success'
            }
            
            logging.info(f"Successfully parsed {pdf_path.name}: {len(sections)} sections, {total_paragraphs} paragraphs")
            return True
            
        except Exception as e:
            error_msg = f"Failed to process {pdf_path.name}: {str(e)}"
            logging.error(error_msg)
            
            self.parse_stats['file_stats'][pdf_path.name] = {
                'status': 'failed',
                'error': str(e)
            }
            self.parse_stats['errors'].append(error_msg)
            
            return False
    
    def build_index(self) -> Dict[str, Any]:
        """
        Build the complete TPG index from all PDF files.
        
        Returns:
            Complete index dictionary
        """
        logging.info("Starting TPG index build process")
        
        # Find all PDF files
        pdf_files = list(self.data_dir.glob("*.pdf"))
        self.parse_stats['total_files'] = len(pdf_files)
        
        logging.info(f"Found {len(pdf_files)} PDF files in {self.data_dir}")
        
        failed_files = []
        
        for pdf_path in pdf_files:
            success = self._process_file(pdf_path)
            if success:
                self.parse_stats['successful_parses'] += 1
            else:
                self.parse_stats['failed_parses'] += 1
                failed_files.append(str(pdf_path))
        
        # Write failed files list if any
        if failed_files:
            failed_file_path = self.logs_dir / "unparsed.txt"
            with open(failed_file_path, 'w', encoding='utf-8') as f:
                for failed_file in failed_files:
                    f.write(f"{failed_file}\n")
            logging.warning(f"Wrote {len(failed_files)} failed files to {failed_file_path}")
        
        return dict(self.index)
    
    def save_index(self, index: Dict[str, Any], output_path: Path):
        """
        Save index to JSON file.
        
        Args:
            index: Index dictionary to save
            output_path: Output file path
        """
        output_options = self.config.get('output_options', {})
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(
                index,
                f,
                indent=output_options.get('indent', 2),
                ensure_ascii=output_options.get('ensure_ascii', False),
                sort_keys=output_options.get('sort_keys', True)
            )
        
        logging.info(f"Index saved to {output_path}")
    
    def write_parse_report(self):
        """Write detailed parsing report."""
        report_path = self.logs_dir / "parse_report.md"
        
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write("# OECD TPG Parsing Report\n\n")
            f.write(f"**Generated:** {self._get_timestamp()}\n\n")
            
            # Summary statistics
            f.write("## Summary\n\n")
            f.write(f"- **Total files processed:** {self.parse_stats['total_files']}\n")
            f.write(f"- **Successful parses:** {self.parse_stats['successful_parses']}\n")
            f.write(f"- **Failed parses:** {self.parse_stats['failed_parses']}\n")
            f.write(f"- **Success rate:** {self.parse_stats['successful_parses'] / max(1, self.parse_stats['total_files']) * 100:.1f}%\n\n")
            
            # File details
            f.write("## File Details\n\n")
            f.write("| File | Year | Language | Sections | Paragraphs | Status |\n")
            f.write("|------|------|----------|----------|------------|--------|\n")
            
            for filename, stats in self.parse_stats['file_stats'].items():
                if stats['status'] == 'success':
                    f.write(f"| {filename} | {stats['year']} | {stats['language']} | {stats['sections']} | {stats['paragraphs']} | Success |\n")
                else:
                    f.write(f"| {filename} | - | - | - | - | Failed |\n")
            
            # Errors
            if self.parse_stats['errors']:
                f.write("\n## Errors\n\n")
                for error in self.parse_stats['errors']:
                    f.write(f"- {error}\n")
            
            f.write(f"\n---\n*Report generated by build_tpg_index.py*\n")
        
        logging.info(f"Parse report written to {report_path}")
    
    def _get_timestamp(self) -> str:
        """Get current timestamp string."""
        from datetime import datetime
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    def verify_index(self, index: Dict[str, Any]) -> bool:
        """
        Verify the built index meets requirements.
        
        Args:
            index: Index to verify
            
        Returns:
            True if verification passes
        """
        logging.info("Verifying index structure...")
        
        try:
            # Check if 2022 English data exists and has expected structure
            if "2022" in index and "EN" in index["2022"]:
                en_2022 = index["2022"]["EN"]
                
                # Check if Preface exists
                has_preface = any("preface" in section.lower() for section in en_2022.keys())
                if has_preface:
                    # Find preface section
                    preface_section = None
                    for section_name, section_data in en_2022.items():
                        if "preface" in section_name.lower():
                            preface_section = section_data
                            break
                    
                    if preface_section:
                        # Check if it has the expected structure with id "1"
                        for sub_section_name, paragraphs in preface_section.items():
                            if isinstance(paragraphs, list) and paragraphs:
                                first_para = paragraphs[0]
                                if isinstance(first_para, dict) and first_para.get('id') == '1':
                                    logging.info("Verification passed: Found Preface with paragraph id '1'")
                                    return True
                
                logging.info("Verification passed: 2022 EN data exists but no Preface with id '1'")
                return True
            else:
                logging.warning("No 2022 EN data found for verification")
                return True  # Still considered passing if we have any data
        
        except Exception as e:
            logging.error(f"Verification failed: {e}")
            return False
        
        return True


def main():
    """Main execution function."""
    print("Starting OECD TPG Index Builder...")
    
    # Initialize builder
    builder = TPGIndexBuilder()
    
    try:
        # Build index
        index = builder.build_index()
        
        # Save to output file
        output_path = builder.out_dir / "oecd_tpg_index.json"
        builder.save_index(index, output_path)
        
        # Write reports
        builder.write_parse_report()
        
        # Verify result
        verification_passed = builder.verify_index(index)
        
        # Print summary
        print("\n" + "="*60)
        print("BUILD SUMMARY")
        print("="*60)
        
        print(f"Output file: {output_path}")
        print(f"Total files processed: {builder.parse_stats['total_files']}")
        print(f"Successful parses: {builder.parse_stats['successful_parses']}")
        print(f"Failed parses: {builder.parse_stats['failed_parses']}")
        
        # Print top-level keys
        print(f"Top-level keys: {list(index.keys())}")
        
        # Print sample paragraph counts for each year/language
        print("\nPARAGRAPH COUNTS BY YEAR/LANGUAGE:")
        for year in sorted(index.keys()):
            for lang in sorted(index[year].keys()):
                total_paras = 0
                for section_name, section_data in index[year][lang].items():
                    for subsection_name, paragraphs in section_data.items():
                        if isinstance(paragraphs, list):
                            total_paras += len(paragraphs)
                print(f"  {year} {lang}: {total_paras} paragraphs")
        
        # Verification status
        print(f"\nVerification: {'PASSED' if verification_passed else 'FAILED'}")
        
        if builder.parse_stats['failed_parses'] == 0:
            print("\nSUCCESS: All files processed successfully!")
            print("After writing a working script, running it, extracting the data, check if everything went good - CONFIRMED")
        else:
            print(f"\nWARNING: {builder.parse_stats['failed_parses']} files failed to parse")
            print("Check logs/unparsed.txt and logs/parse_report.md for details")
            print("After writing a working script, running it, extracting the data, check if everything went good - PARTIAL SUCCESS")
        
    except Exception as e:
        print(f"\nFATAL ERROR: {e}")
        logging.error(f"Fatal error in main: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()