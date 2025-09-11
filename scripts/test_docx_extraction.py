#!/usr/bin/env python3
"""
Test script for OECD DOCX extraction functionality.

This script tests the Word document extraction with the OECD_TPG_EN_2022.docx file
and provides detailed analysis of the extraction results.
"""

import json
import logging
from pathlib import Path
from extract_oecd_docx import OECDDocxExtractor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def analyze_extraction_results(result: dict, output_file: Path):
    """Analyze and report on extraction results."""
    logger.info("=== EXTRACTION ANALYSIS ===")
    
    metadata = result.get("metadata", {})
    sections = result.get("sections", {})
    paragraphs = result.get("paragraphs", [])
    
    # Basic statistics
    logger.info(f"Total paragraphs extracted: {len(paragraphs)}")
    logger.info(f"Total sections found: {len(sections)}")
    logger.info(f"Sections: {', '.join(sections.keys())}")
    
    # Analyze paragraph numbering
    numbered_paragraphs = [p for p in paragraphs if p.get("paragraph_number")]
    logger.info(f"Paragraphs with OECD numbering: {len(numbered_paragraphs)}")
    
    # Analyze headings
    headings = [p for p in paragraphs if p.get("is_heading")]
    logger.info(f"Headings found: {len(headings)}")
    
    # Section breakdown
    logger.info("\n=== SECTION BREAKDOWN ===")
    for section_name, section_paragraphs in sections.items():
        section_headings = [p for p in section_paragraphs if p.get("is_heading")]
        section_numbered = [p for p in section_paragraphs if p.get("paragraph_number")]
        logger.info(f"{section_name}: {len(section_paragraphs)} paragraphs "
                   f"({len(section_headings)} headings, {len(section_numbered)} numbered)")
    
    # Sample paragraph numbers
    logger.info("\n=== SAMPLE PARAGRAPH NUMBERS ===")
    sample_numbers = [p["paragraph_number"] for p in paragraphs 
                     if p.get("paragraph_number")][:10]
    for num in sample_numbers:
        logger.info(f"  - {num}")
    
    # Sample headings
    logger.info("\n=== SAMPLE HEADINGS ===")
    sample_headings = [(p["text"][:80] + "..." if len(p["text"]) > 80 else p["text"]) 
                      for p in paragraphs if p.get("is_heading")][:5]
    for heading in sample_headings:
        logger.info(f"  - {heading}")
    
    # Check for content that should be filtered
    logger.info("\n=== CONTENT FILTERING CHECK ===")
    copyright_found = any("©" in p["text"] or "OECD" in p["text"].upper() 
                         for p in paragraphs if len(p["text"]) < 50)
    logger.info(f"Potential copyright content found: {copyright_found}")
    
    # Style information
    styles_used = set()
    for p in paragraphs:
        if p.get("style_name"):
            styles_used.add(p["style_name"])
    
    logger.info(f"\n=== STYLES DETECTED ===")
    logger.info(f"Unique styles: {len(styles_used)}")
    for style in sorted(styles_used)[:10]:  # Show first 10 styles
        logger.info(f"  - {style}")

def test_specific_docx_file():
    """Test extraction on the specific OECD TPG file."""
    data_dir = Path("../data")
    output_dir = Path("../out/test")
    
    # Find the specific OECD TPG file
    target_file = data_dir / "OECD_TPG_EN_2022.docx"
    
    if not target_file.exists():
        logger.error(f"Target file not found: {target_file}")
        return False
        
    # Create output directory
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Initialize extractor
    extractor = OECDDocxExtractor()
    
    try:
        logger.info(f"Testing extraction with {target_file.name}")
        
        # Extract content
        result = extractor.extract_from_docx(target_file)
        
        # Generate output filename
        output_file = output_dir / f"{target_file.stem}_test_extraction.json"
        
        # Save results
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
            
        logger.info(f"Test extraction saved to {output_file}")
        
        # Analyze results
        analyze_extraction_results(result, output_file)
        
        return True
        
    except Exception as e:
        logger.error(f"Test extraction failed: {e}")
        return False

def validate_paragraph_structure():
    """Validate that paragraph structure is preserved correctly."""
    logger.info("\n=== PARAGRAPH STRUCTURE VALIDATION ===")
    
    # Load test results
    test_file = Path("../out/test/OECD_TPG_EN_2022_test_extraction.json")
    
    if not test_file.exists():
        logger.error(f"Test file not found: {test_file}")
        return False
        
    with open(test_file, 'r', encoding='utf-8') as f:
        result = json.load(f)
        
    paragraphs = result.get("paragraphs", [])
    
    # Check for proper paragraph numbering sequence
    numbered_paras = [(p["paragraph_number"], p["text"][:50] + "...") 
                     for p in paragraphs if p.get("paragraph_number")]
    
    logger.info(f"Found {len(numbered_paras)} numbered paragraphs")
    
    # Look for common OECD patterns
    chapter_paras = [p for p in paragraphs if "chapter" in p["text"].lower()]
    article_paras = [p for p in paragraphs if "article" in p["text"].lower()]
    annex_paras = [p for p in paragraphs if "annex" in p["text"].lower()]
    
    logger.info(f"Chapter references: {len(chapter_paras)}")
    logger.info(f"Article references: {len(article_paras)}")
    logger.info(f"Annex references: {len(annex_paras)}")
    
    # Check section organization
    sections = result.get("sections", {})
    expected_sections = ["preface", "chapter", "annex", "unknown"]
    
    found_expected = [s for s in expected_sections if s in sections]
    logger.info(f"Expected sections found: {found_expected}")
    
    return True

def main():
    """Main test execution."""
    logger.info("Starting OECD DOCX extraction tests...")
    
    # Test extraction
    success = test_specific_docx_file()
    
    if success:
        # Validate results
        validate_paragraph_structure()
        logger.info("All tests completed successfully!")
    else:
        logger.error("Tests failed!")
        
if __name__ == "__main__":
    main()