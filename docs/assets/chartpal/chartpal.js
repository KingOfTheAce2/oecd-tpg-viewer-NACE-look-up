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

// --- NEW Globals & State Management ---
let chartNodes = new Map(); // Stores node data { id, name, parent_id, etc. }
let chartLines = []; // Stores the LeaderLine instances

// --- Main function to draw the chart from data ---
function drawChartFromData(records) {
    // 1. Clear existing canvas
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '';
    chartLines.forEach(line => line.remove());
    chartLines = [];
    chartNodes.clear();

    // 2. Create and store node data
    const nodesData = buildHierarchy(records);
    
    // 3. Render boxes and store them in our map
    let yPos = 30; // Initial vertical position
    nodesData.children.forEach(nodeData => {
        renderNode(nodeData, 30, yPos);
        yPos += 150; // Stagger initial root nodes
    });
    
    // 4. Draw connecting lines
    chartNodes.forEach(node => {
        if (node.parent_id && chartNodes.has(node.parent_id)) {
            const parentEl = document.getElementById(`node-${node.parent_id}`);
            const childEl = document.getElementById(`node-${node.id}`);
            
            const line = new LeaderLine(parentEl, childEl, {
                middleLabel: LeaderLine.pathLabel(`${node.ownership || 100}%`)
            });
            chartLines.push(line);
        }
    });
    
    // 5. Update the side tree view
    document.getElementById('tree-output-display').textContent = generateTreeOutput(nodesData);
}

// --- Renders a single node box on the canvas ---
function renderNode(nodeData, x, y) {
    const canvas = document.getElementById('canvas');
    const nodeEl = document.createElement('div');
    nodeEl.id = `node-${nodeData.id}`;
    nodeEl.className = 'chart-node';
    nodeEl.style.left = `${x}px`;
    nodeEl.style.top = `${y}px`;

    // Populate the box content
    const flag = nodeData.jurisdiction ? countryFlagEmoji(nodeData.jurisdiction) + ' ' : '';
    nodeEl.innerHTML = `
        <strong>${nodeData.name || 'Unnamed'}</strong><br>
        <small>${flag}${nodeData.jurisdiction || 'N/A'}</small>
    `;

    canvas.appendChild(nodeEl);
    chartNodes.set(nodeData.id, nodeData); // Add to our state map

    // Make the node draggable (simple implementation)
    makeDraggable(nodeEl);
    
    // Render children recursively (simple vertical layout)
    let childY = y + 150;
    let childX = x + 50;
    if (nodeData.children) {
        nodeData.children.forEach(child => {
            renderNode(child, childX, childY);
            childY += 150; // Adjust spacing as needed
        });
    }
}

// --- Utility to make an element draggable ---
function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    element.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
        // Update all connecting lines
        chartLines.forEach(line => line.position());
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// --- NEW: Function to export the visual chart to CSV ---
function exportToCsv() {
    const headers = "id,parent_id,name,ownership%,jurisdiction";
    let csvContent = [headers];

    // The buildHierarchy function already gives us a flat list with parent_id
    // We can just iterate through our 'chartNodes' map
    chartNodes.forEach(node => {
        const row = [
            node.id,
            node.parent_id || '0',
            `"${node.name}"`, // Quote names to handle commas
            node.ownership || '',
            node.jurisdiction || ''
        ].join(',');
        csvContent.push(row);
    });

    // Update the textarea and provide a download link
    const csvText = csvContent.join('\n');
    document.getElementById('csvtext').value = csvText;
    
    // Trigger download
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'org-chart-export.csv';
    a.click();
    URL.revokeObjectURL(url);
}

// --- REVISED: Event handler to import from CSV text area ---
async function handleImport() {
    const text = document.getElementById('csvtext').value.trim();
    if (!text) {
        showError('CSV data is empty.');
        return;
    }
    try {
        const records = parseCsvText(text);
        drawChartFromData(records); // NEW: This now draws the visual chart
        showError(''); // Clear errors
    } catch (err) {
        showError('Failed to import chart: ' + err.message);
        console.error(err);
    }
}

// --- NEW: Add a blank node to the canvas ---
function handleAddNode() {
    const newId = (Math.max(0, ...Array.from(chartNodes.keys()).map(k => parseInt(k))) + 1).toString();
    const newNodeData = {
        id: newId,
        parent_id: '0', // Root node by default
        name: `New Company ${newId}`,
        jurisdiction: 'US', // Default
        ownership: 100,
        children: []
    };
    renderNode(newNodeData, 50, 50); // Add at a default position
    
    // Also update the tree view
    const allRecords = Array.from(chartNodes.values());
    const root = buildHierarchy(allRecords);
    document.getElementById('tree-output-display').textContent = generateTreeOutput(root);
}


// --- REVISED: Update DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    loadCountryNames();

    // NEW event listeners
    document.getElementById('import-from-csv').addEventListener('click', handleImport);
    document.getElementById('export-csv').addEventListener('click', exportToCsv);
    document.getElementById('add-node').addEventListener('click', handleAddNode);

    // Initial load with sample data
    // The old handleGenerate can be renamed to handleImport
    handleImport(); 
});
