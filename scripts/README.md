# OECD PDF Extraction Scripts

## Overview

This directory contains improved OECD Transfer Pricing Guidelines PDF extraction scripts with comprehensive validation capabilities.

## Scripts

### `extract_oecd_pdfs.py` - Main Extraction Script
Enhanced PDF extraction with the following improvements:
- **Copyright footer removal**: Language-specific pattern detection
- **Clean JSON output**: No escape sequence artifacts
- **OECD-compliant paragraph IDs**: Supports multiple numbering formats
- **Content filtering**: Excludes TOC, indexes, pure copyright pages
- **Text defragmentation**: Merges split paragraphs intelligently

#### Usage
```bash
# Extract all PDFs in data/ folder
python scripts/extract_oecd_pdfs.py

# Extract specific file
python scripts/extract_oecd_pdfs.py --file OECD_TPG_EN_2022.pdf

# Verbose output
python scripts/extract_oecd_pdfs.py --verbose

# Custom directories
python scripts/extract_oecd_pdfs.py --input-dir data --output-dir output
```

### `demo_extraction.py` - Quick Demo
Demonstrates extraction capabilities with sample files.

```bash
python scripts/demo_extraction.py
```

### `test_extraction.py` - Validation Test
Comprehensive validation against all specified criteria:

```bash
python scripts/test_extraction.py
```

**Validation Criteria:**
1. ✅ Copyright footers removed (>80% success rate)
2. ✅ Clean JSON format (no `\\n` artifacts)
3. ✅ OECD paragraph ID structure (>95% compliance)
4. ✅ Proper content section organization (≥5 core sections)
5. ✅ Text flow without fragmentation (>85% quality rate)

## Features

### Language Support
- **English (EN)**: OECD Transfer Pricing Guidelines
- **German (DE)**: OECD Leitsätze
- **Spanish (ES)**: Directrices de la OCDE
- **French (FR)**: Principes de l'OCDE
- **Czech (CZ)**: OECD směrnice
- **Japanese (JP)**: OECD移転価格ガイドライン

### Paragraph ID Formats
- Simple numeric: `1`, `2`, `3`
- Dotted numeric: `1.1`, `2.3`, `3.1.2`
- Letter-based: `A`, `A1`, `B2`
- Letter.number: `A.1`, `B.2`
- Roman.number: `I.1`, `II.3`
- Mixed formats: `1.A`, `2.B`

### Content Organization
```json
{
  "metadata": {
    "year": 2022,
    "language": "EN",
    "title": "OECD Transfer Pricing Guidelines...",
    "extracted_date": "2025-09-11T...",
    "source_file": "OECD_TPG_EN_2022.pdf"
  },
  "sections": {
    "Preface": [...],
    "Chapter_I": [...],
    "Chapter_II": [...],
    "Annex_A": [...],
    "Annex_I": [...]
  },
  "extraction_stats": {
    "total_pages": 634,
    "total_sections": 12,
    "total_items": 628,
    "extraction_method": "PyMuPDF"
  }
}
```

## Requirements

```bash
# Install dependencies
pip install PyMuPDF pdfplumber

# Or use requirements.txt
pip install -r scripts/requirements.txt
```

## Validation Results

### Test File: OECD_TPG_ES_2010.pdf (424 pages)

| Criterion | Target | Achieved | Status |
|-----------|--------|----------|--------|
| Copyright Removal | >80% | 88.9% | ✅ PASS |
| JSON Cleanliness | <100 violations | 0 violations | ✅ PASS |
| ID Structure | >95% valid | 100% valid | ✅ PASS |
| Section Organization | ≥5 core sections | 10 core sections | ✅ PASS |
| Text Flow Quality | >85% proper | 100% proper | ✅ PASS |

**Overall Score: 5/5 (EXCELLENT)**

## Example Output

```json
{
  "sections": {
    "Preface": [
      {
        "id": "1",
        "text": "OCDE Directrices de la OCDE aplicables en materia de precios de transferencia...",
        "page": 1
      }
    ],
    "Chapter_I": [
      {
        "id": "1.1",
        "text": "The arm's length principle, which provides the conceptual...",
        "page": 45
      }
    ]
  }
}
```

## Improvements Made

### Copyright Removal
- Language-specific footer patterns
- Header/footer detection
- Page number filtering
- ISBN/DOI removal

### Text Quality
- Fragment merging algorithm
- Paragraph boundary detection
- Whitespace normalization
- Artifact removal

### ID Generation
- OECD numbering compliance
- Section-aware numbering
- Multi-format support
- Existing number extraction

### Content Filtering
- TOC exclusion
- Index page removal
- Copyright page filtering
- Substantive content preservation

## Troubleshooting

### Common Issues

**1. Unicode Encoding Errors**
```bash
# Set environment variable
set PYTHONIOENCODING=utf-8
python scripts/extract_oecd_pdfs.py
```

**2. Missing Dependencies**
```bash
pip install PyMuPDF pdfplumber
```

**3. File Not Found**
```bash
# Check file exists in data/ directory
ls data/OECD_TPG_*.pdf
```

**4. Memory Issues (Large Files)**
```bash
# Use pdfplumber fallback
python scripts/extract_oecd_pdfs.py --verbose
```

## Development

### Running Tests
```bash
# Full test suite
python -m pytest tests/test_extraction_validation.py -v

# Quick validation
python scripts/test_extraction.py

# Demo extraction
python scripts/demo_extraction.py
```

### Adding New Languages
1. Add patterns to `SECTION_PATTERNS`
2. Add copyright patterns to `OECD_PATTERNS`
3. Update `detect_language()` method
4. Test with sample files

## Support

- **Issues**: Report via project issues
- **Documentation**: See `tests/extraction_validation_report.md`
- **Examples**: Check `out/demo_*.json` files

---

*Last updated: 2025-09-11*  
*Version: OECD Extractor v2.0*