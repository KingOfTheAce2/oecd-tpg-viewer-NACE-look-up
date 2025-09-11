#!/usr/bin/env python3
"""
Quick demo of the improved OECD extraction script
"""

import sys
from pathlib import Path
import json

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts.extract_oecd_pdfs import PDFExtractor

def main():
    print("OECD PDF Extraction Demo")
    print("========================")
    
    # Initialize extractor
    extractor = PDFExtractor(
        input_dir="data", 
        output_dir="out/test",
        verbose=True
    )
    
    # Test with a smaller file first
    test_files = ["OECD_TPG_ES_2010.pdf", "OECD_TPG_FR_2017.pdf"]
    
    for filename in test_files:
        pdf_path = Path("data") / filename
        if pdf_path.exists():
            print(f"\n{'='*60}")
            print(f"Processing {filename}")
            print(f"{'='*60}")
            
            result = extractor.process_pdf(pdf_path)
            
            if result:
                # Show sample output
                print(f"\nExtraction successful!")
                print(f"  - Pages: {result['extraction_stats']['total_pages']}")
                print(f"  - Sections: {result['extraction_stats']['total_sections']}")
                print(f"  - Items: {result['extraction_stats']['total_items']}")
                print(f"  - Method: {result['extraction_stats']['extraction_method']}")
                
                print(f"\nSections found:")
                for section_name, items in result['sections'].items():
                    print(f"  - {section_name}: {len(items)} items")
                
                # Show sample content
                print(f"\nSample content from first section:")
                first_section = list(result['sections'].keys())[0]
                first_items = result['sections'][first_section][:3]
                
                for item in first_items:
                    print(f"  ID: {item['id']}")
                    print(f"  Page: {item['page']}")
                    print(f"  Text: {item['text'][:100]}...")
                    print()
                
                # Save demo output
                output_path = Path("out") / f"demo_{filename.replace('.pdf', '.json')}"
                output_path.parent.mkdir(exist_ok=True)
                
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(result, f, indent=2, ensure_ascii=False)
                
                print(f"Demo output saved to: {output_path}")
                
            else:
                print(f"Failed to extract {filename}")
        else:
            print(f"File not found: {filename}")
    
    print(f"\n{'='*60}")
    print("Demo complete!")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()