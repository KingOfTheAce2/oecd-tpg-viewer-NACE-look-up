// ChartPal - ASCII/Unicode Organisational Chart Builder
let countryNames = {};
let currentCsvText = '';
let currentZoom = 100; // Zoom level in percent

// --- DATA & PARSING ---

async function loadCountryNames(url = 'assets/chartpal/country_names.json') {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Could not load country names');
        const data = await response.json();
        // Convert array of objects to a simple { "code": "Name" } object
        countryNames = data.reduce((acc, country) => {
            acc[country.code] = country.name;
            return acc;
        }, {});
        populateJurisdictionReference();
    } catch (e) {
        console.error('Failed to load country names:', e);
        showError('Could not load country reference list.');
    }
}

function parseCsvText(text) {
    // Use PapaParse for robust CSV parsing
    const result = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
    if (result.errors.length > 0) {
        console.error("CSV Parsing Errors:", result.errors);
        throw new Error(`CSV Error: ${result.errors[0].message} on row ${result.errors[0].row}.`);
    }
    return result.data.map(r => {
        // Ensure parent_id=0 for root nodes if missing
        if (!r.parent_id) r.parent_id = '0';
        return r;
    });
}

function buildHierarchy(records) {
    const nodes = new Map();
    records.forEach(rec => {
        // Clean up ownership percentage
        if (rec['ownership%'] !== undefined) {
             let val = String(rec['ownership%']).trim().replace('%', '');
             if (val !== '' && !isNaN(val)) {
                rec.ownership = parseFloat(val);
             }
        }
        nodes.set(rec.id, { ...rec, children: [] });
    });
    
    const roots = [];
    nodes.forEach(node => {
        if (node.parent_id && nodes.has(node.parent_id)) {
            nodes.get(node.parent_id).children.push(node);
        } else {
            roots.push(node);
        }
    });
    return { children: roots };
}

// --- OUTPUT GENERATORS ---

function countryFlagEmoji(code) {
    if (!code || typeof code !== 'string' || code.length !== 2) return '';
    const base = 127397;
    return String.fromCodePoint(
        base + code.toUpperCase().charCodeAt(0),
        base + code.toUpperCase().charCodeAt(1)
    );
}

/**
 * Generates the Tree View output (Format A)
 */
function generateTreeOutput(root) {
    const lines = [];
    function walk(node, prefix, isRoot, isLast) {
        const flag = node.jurisdiction ? countryFlagEmoji(node.jurisdiction) + ' ' : '';
        const own = node.ownership !== undefined ? ` (${node.ownership}%)` : '';
        const label = `${flag}${node.name || node.id}${own}`;
        
        if (isRoot) {
            lines.push(label);
        } else {
            lines.push(prefix + (isLast ? '└─ ' : '├─ ') + label);
        }
        
        const children = node.children || [];
        const newPrefix = prefix + (isRoot ? '' : (isLast ? '   ' : '│  '));
        children.forEach((c, idx) => walk(c, newPrefix, false, idx === children.length - 1));
    }
    root.children.forEach((c, idx) => walk(c, '', true, idx === root.children.length - 1));
    return lines.join('\n');
}

/**
 * Generates the Box View output (Format B)
 */
function generateBoxOutput(root) {
    const lines = [];
    function walk(node, prefix = '') {
        const own = node.ownership !== undefined ? `, ${node.ownership}%` : '';
        const jur = node.jurisdiction ? `, ${node.jurisdiction}` : '';
        const content = ` ${node.name || node.id}${jur}${own} `;
        const width = content.length;
        const boxTop = `+${'-'.repeat(width)}+`;
        const boxMid = `|${content}|`;
        
        lines.push(prefix + boxTop);
        lines.push(prefix + boxMid);
        lines.push(prefix + boxTop);

        const children = node.children || [];
        children.forEach((child, idx) => {
            const isLastChild = idx === children.length - 1;
            const connector = '     |';
            const arrow = '     v';
            lines.push(prefix + connector);
            lines.push(prefix + arrow);
            walk(child, prefix); // Simple vertical stack for all children
        });
    }
    root.children.forEach(c => walk(c));
    return lines.join('\n');
}

// --- UI & EVENT HANDLERS ---

function showError(msg) {
    const box = document.getElementById('error-box');
    if (box) box.textContent = msg;
}

async function handleGenerate() {
    const file = document.getElementById('csvfile').files[0];
    const textArea = document.getElementById('csvtext');
    let text = textArea.value.trim();

    try {
        if (file) {
            text = await file.text();
            textArea.value = text;
        }
        if (!text) {
            showError('Please provide CSV data by pasting or uploading a file.');
            return;
        }
        
        currentCsvText = text;
        const records = parseCsvText(text);
        const root = buildHierarchy(records);
        const format = document.querySelector('input[name="format"]:checked').value;
        
        let output = '';
        if (format === 'tree') {
            output = generateTreeOutput(root);
        } else if (format === 'box') {
            output = generateBoxOutput(root);
        }

        document.getElementById('chart-output').textContent = output;
        showError(''); // Clear previous errors
    } catch (err) {
        showError('Failed to generate chart: ' + err.message);
        console.error(err);
    }
}

function downloadCsv() {
    if (!currentCsvText) {
        showError('Nothing to download. Please generate a chart first.');
        return;
    }
    const blob = new Blob([currentCsvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'org-chart.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function updateZoom(newZoom) {
    currentZoom = Math.max(20, Math.min(300, newZoom)); // Clamp zoom between 20% and 300%
    document.getElementById('chart-output').style.fontSize = `${currentZoom}%`;
    document.getElementById('zoom-level').textContent = `${currentZoom}%`;
}

function populateJurisdictionReference() {
    const list = document.getElementById('jurisdiction-list');
    list.innerHTML = ''; // Clear existing
    Object.entries(countryNames).forEach(([code, name]) => {
        const li = document.createElement('li');
        li.textContent = `${countryFlagEmoji(code)} ${code} - ${name}`;
        li.dataset.search = `${code} ${name}`.toLowerCase();
        list.appendChild(li);
    });
}

function filterJurisdictionList() {
    const filter = document.getElementById('jurisdiction-search').value.toLowerCase();
    const items = document.querySelectorAll('#jurisdiction-list li');
    items.forEach(item => {
        if (item.dataset.search.includes(filter)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

// --- INITIALIZATION ---

document.addEventListener('DOMContentLoaded', () => {
    // Load external data
    loadCountryNames();

    // Setup event listeners
    document.getElementById('generate').addEventListener('click', handleGenerate);
    document.getElementById('download-csv').addEventListener('click', downloadCsv);
    document.getElementById('zoom-in').addEventListener('click', () => updateZoom(currentZoom + 10));
    document.getElementById('zoom-out').addEventListener('click', () => updateZoom(currentZoom - 10));
    document.getElementById('jurisdiction-search').addEventListener('input', filterJurisdictionList);
    
    // Auto-generate chart from sample data on load
    handleGenerate();
});
