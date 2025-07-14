# OECD TPG Viewer & NACE Code Finder

This repository contains a small static website with several tools:

1. **OECD Transfer Pricing Guidelines Viewer** – a searchable viewer for paragraphs from the OECD Transfer Pricing Guidelines.
2. **NACE Rev. 2.1 Code Finder** – an interface for searching activities in the NACE classification.
3. **Sankey Diagram Generator** – create simple Sankey diagrams from CSV/JSON data.
4. **Charted** – A Flask-based organisational chart builder by A.C. van der Linde (see `docs/assets/charted_app/`).

The site is contained entirely in the `docs/` directory and can be used locally or hosted on any static web server.

## Usage

No build step is required. Open `docs/index.html` in a web browser. From there you can navigate to:

* `oecd.html` – provides a search box that filters paragraphs in real time. Data is loaded dynamically from the `assets/oecd/<language>/<chapter>.json` files.
  Supported language folders include `en`, `es`, `fr`, `de`, `ja`, and `sk`.
* `nace.html` – loads `assets/nace/nace-app.js` which renders the NACE code finder using React.
* `sankey.html` – a simple page for creating Sankey diagrams.
* `charted.html` – instructions for running the Charted organisational chart builder.

## File Layout

```
/docs
  index.html          # Landing page linking to the two apps
  oecd.html           # OECD TPG Viewer page
  nace.html           # NACE Code Finder page
  sankey.html         # Sankey Diagram Generator page
  charted.html        # Instructions for Charted app
  /assets
    style.css            # Shared styles
    /oecd
      OECD-TPG-EN-2022.js  # Original dataset
      index.js             # Logic for the OECD viewer
      /en
        1.json             # Chapter 1 paragraphs (English)
        10.json            # Chapter 10 paragraphs (English)
      ...language folders for es/fr/de/ja/sk
        # e.g., docs/assets/oecd/sk/ for Slovenian
    /nace
      nace_data.json       # Dataset of NACE codes
      nace-app.js          # React app for the NACE finder
```

## Notes

The data files included in `docs/assets` are provided for convenience and are relatively small in this demo. They can be replaced or updated by editing the corresponding files.

## Citation

When using the OECD Transfer Pricing Guidelines data please cite:

```
OECD (2022), OECD Transfer Pricing Guidelines for Multinational Enterprises and Tax Administrations 2022, OECD Publishing, Paris.
```

## Document Extraction

The repository includes small Python scripts for extracting paragraph numbers
and text from OECD TPG documents. Drop DOCX files into the `data/` directory and
run:

```bash
pip install -r requirements.txt

python scripts/extract_docx.py
```

The script outputs JSON files to `output/<year>/` with empty `title` and
`explanation` fields so they can be filled in manually later. A GitHub Action
(`.github/workflows/run_extract.yml`) is provided to run the script automatically
whenever new DOCX files are pushed to the `data/` folder.

Note: Large DOCX files (the 2022 edition spans 658 pages and millions of words)
may take a little while to process, but the script streams paragraphs in order
so memory usage remains modest.
