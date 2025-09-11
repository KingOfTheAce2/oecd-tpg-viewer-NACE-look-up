#!/usr/bin/env python3
"""
Generate a summary report of the DOCX extraction results.
"""

import json
import sys
from pathlib import Path
from typing import Dict, Any

def analyze_extraction(json_file: Path) -> Dict[str, Any]:
    """Analyze the extracted JSON file and generate statistics."""
    
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    metadata = data.get('metadata', {})
    sections = data.get('sections', {})
    
    # Basic statistics
    total_sections = len(sections)
    total_paragraphs = sum(len(paragraphs) for paragraphs in sections.values())
    
    # Analyze paragraph numbering
    oecd_numbered = []
    all_ids = []
    
    for section_name, paragraphs in sections.items():
        for para in paragraphs:
            para_id = para.get('id', '')
            all_ids.append(para_id)
            
            # Check for OECD numbering patterns
            if ('.' in para_id and any(c.isdigit() for c in para_id)):
                oecd_numbered.append(para_id)
    
    # Section analysis
    section_stats = {}
    for section_name, paragraphs in sections.items():
        section_stats[section_name] = {
            'paragraph_count': len(paragraphs),
            'has_oecd_numbering': any('.' in p.get('id', '') and any(c.isdigit() for c in p.get('id', '')) 
                                    for p in paragraphs)
        }
    
    # Content quality checks
    sample_content = []
    for section_name, paragraphs in sections.items():
        if paragraphs:
            sample_para = paragraphs[0]
            sample_content.append({
                'section': section_name,
                'id': sample_para.get('id', ''),
                'text_preview': sample_para.get('text', '')[:100] + "..." 
                              if len(sample_para.get('text', '')) > 100 
                              else sample_para.get('text', '')
            })
    
    return {
        'metadata': metadata,
        'statistics': {
            'total_sections': total_sections,
            'total_paragraphs': total_paragraphs,
            'oecd_numbered_paragraphs': len(oecd_numbered),
            'unique_ids': len(set(all_ids))
        },
        'section_breakdown': section_stats,
        'sample_content': sample_content[:10],  # First 10 sections
        'oecd_numbering_samples': oecd_numbered[:10]  # First 10 OECD numbers
    }

def print_summary(analysis: Dict[str, Any]):
    """Print a formatted summary of the analysis."""
    
    print("=" * 60)
    print("OECD TPG DOCX EXTRACTION SUMMARY")
    print("=" * 60)
    
    # Metadata
    metadata = analysis['metadata']
    print(f"\n[DOCUMENT] Information:")
    print(f"   Source: {metadata.get('source_file', 'Unknown')}")
    print(f"   Year: {metadata.get('year', 'Unknown')}")
    print(f"   Language: {metadata.get('language', 'Unknown')}")
    print(f"   Extracted: {metadata.get('extracted_date', 'Unknown')}")
    
    # Statistics
    stats = analysis['statistics']
    print(f"\n[STATISTICS] Extraction Results:")
    print(f"   Total Sections: {stats['total_sections']}")
    print(f"   Total Paragraphs: {stats['total_paragraphs']}")
    print(f"   OECD Numbered Paragraphs: {stats['oecd_numbered_paragraphs']}")
    print(f"   Unique IDs: {stats['unique_ids']}")
    
    # Section breakdown
    print(f"\n[SECTIONS] Analysis:")
    section_stats = analysis['section_breakdown']
    
    # Key sections
    key_sections = ['Introduction', 'Chapter_I', 'Chapter_II', 'Chapter_III', 
                   'Chapter_IV', 'Chapter_V', 'Chapter_VI', 'Chapter_VII', 
                   'Chapter_VIII', 'Chapter_IX']
    
    for section in key_sections:
        if section in section_stats:
            stats = section_stats[section]
            oecd_indicator = "YES" if stats['has_oecd_numbering'] else "NO"
            print(f"   {section}: {stats['paragraph_count']} paragraphs [OECD numbering: {oecd_indicator}]")
    
    # Annexes
    annexes = [s for s in section_stats.keys() if 'Annex' in s]
    if annexes:
        print(f"   Annexes found: {len(annexes)}")
        for annex in annexes[:5]:  # Show first 5 annexes
            stats = section_stats[annex]
            print(f"     - {annex[:50]}{'...' if len(annex) > 50 else ''}: {stats['paragraph_count']} paragraphs")
    
    # OECD numbering samples
    if analysis['oecd_numbering_samples']:
        print(f"\n[NUMBERING] OECD Paragraph Samples:")
        for num in analysis['oecd_numbering_samples']:
            print(f"   - {num}")
    
    # Content samples
    print(f"\n[CONTENT] Text Samples:")
    for i, sample in enumerate(analysis['sample_content'][:5], 1):
        print(f"   {i}. Section: {sample['section']}")
        print(f"      ID: {sample['id']}")
        print(f"      Text: {sample['text_preview']}")
        print()

def main():
    """Main execution function."""
    
    # Default file path
    json_file = Path("../out/OECD_TPG_EN_2022_docx.json")
    
    # Check if file exists
    if not json_file.exists():
        print(f"Error: JSON file not found at {json_file}")
        print("Make sure you've run the extraction script first.")
        sys.exit(1)
    
    try:
        # Analyze extraction
        analysis = analyze_extraction(json_file)
        
        # Print summary
        print_summary(analysis)
        
        # Save detailed analysis
        analysis_file = json_file.parent / f"{json_file.stem}_analysis.json"
        with open(analysis_file, 'w', encoding='utf-8') as f:
            json.dump(analysis, f, indent=2, ensure_ascii=False)
        
        print(f"\n[SAVED] Detailed analysis saved to: {analysis_file}")
        
    except Exception as e:
        print(f"Error analyzing extraction: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()