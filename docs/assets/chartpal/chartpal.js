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
        // Handle both array-of-objects and plain object structures
        if (Array.isArray(data)) {
            countryNames = data.reduce((acc, country) => {
                acc[country.code] = country.name;
                return acc;
            }, {});
        } else {
            countryNames = data;
        }
        if (document.getElementById('jurisdiction-list')) {
            populateJurisdictionReference();
        }
        if (document.getElementById('jurisdictions')) {
            populateJurisdictionDatalist();
        }
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
        // normalise keys to lower case for robustness
        const rec = {};
        Object.entries(r).forEach(([k,v]) => rec[k.trim().toLowerCase()] = v);

        // Ensure parent_id=0 for root nodes if missing
        if (!rec.parent_id) rec.parent_id = '0';

        // support both ownership% and ownership columns
        let ownVal = rec['ownership%'] || rec['ownership'] || '';
        if (ownVal !== '') {
            ownVal = String(ownVal).trim().replace('%','');
            if (!isNaN(ownVal)) rec.ownership = parseFloat(ownVal);
        }

        rec.id = rec.id || '';
        return rec;
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
    if (!list) return;
    list.innerHTML = ''; // Clear existing
    Object.entries(countryNames).forEach(([code, name]) => {
        const li = document.createElement('li');
        li.textContent = `${countryFlagEmoji(code)} ${code} - ${name}`;
        li.dataset.search = `${code} ${name}`.toLowerCase();
        list.appendChild(li);
    });
    if (window.twemoji) twemoji.parse(list);
}

function filterJurisdictionList() {
    const search = document.getElementById('jurisdiction-search');
    if (!search) return;
    const filter = search.value.toLowerCase();
    const items = document.querySelectorAll('#jurisdiction-list li');
    items.forEach(item => {
        if (item.dataset.search.includes(filter)) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

function populateJurisdictionDatalist() {
    const datalist = document.getElementById('jurisdictions');
    if (!datalist) return;
    datalist.innerHTML = '';
    Object.entries(countryNames).forEach(([code, name]) => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.dataset.code = code;
        opt.label = `${countryFlagEmoji(code)} ${name}`;
        opt.textContent = `${countryFlagEmoji(code)} ${name}`;
        datalist.appendChild(opt);
    });
    if (window.twemoji) twemoji.parse(datalist);
}

function getJurisdictionName(code) {
    if (!code) return 'N/A';
    return countryNames[code.toUpperCase()] || code;
}

function updateTreeView() {
    const allRecords = Array.from(chartNodes.values());
    const root = buildHierarchy(allRecords);
    const pre = document.getElementById('tree-output-display');
    pre.textContent = generateTreeOutput(root);
    if (window.twemoji) twemoji.parse(pre);
}

// --- INITIALIZATION ---


// --- NEW Globals & State Management ---
let chartNodes = new Map(); // Stores node data { id, name, parent_id, etc. }
let chartLines = []; // Stores the LeaderLine instances
let selectedNodeId = null; // Currently selected node
let connectMode = false;
let connectParentId = null;
let canvasScale = 1;

function safeId(id) {
    return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

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
        const parentEl = document.getElementById(`node-${safeId(node.parent_id)}`);
        const childEl = document.getElementById(`node-${safeId(node.id)}`);

        const label = LeaderLine.pathLabel(`${node.ownership || 100}%`);
        label.style.fontSize = '14px';
        const options = {
            color: '#007bff',
            size: 2,
            path: 'straight',
            startSocket: 'bottom',
            endSocket: 'top',
            middleLabel: label
        };
        if (node.ownership && node.ownership < 100) {
            options.dash = {len: 4, gap: 4};
        }
        const line = new LeaderLine(parentEl, childEl, options);
        if (line.middleLabel && line.middleLabel.nodeType === 1) {
            line.middleLabel.style.transform = `scale(${1 / canvasScale})`;
        }
        chartLines.push(line);
        }
    });
    
    // 5. Update the side tree view
    const pre = document.getElementById('tree-output-display');
    pre.textContent = generateTreeOutput(nodesData);
    if (window.twemoji) twemoji.parse(pre);
}

// --- Renders a single node box on the canvas ---
function renderNode(nodeData, x, y) {
    const canvas = document.getElementById('canvas');
    const nodeEl = document.createElement('div');
    nodeEl.id = `node-${safeId(nodeData.id)}`;
    nodeEl.className = 'chart-node';
    nodeEl.dataset.id = nodeData.id;
    nodeEl.style.left = `${x}px`;
    nodeEl.style.top = `${y}px`;

    // Populate the box content
    const flag = nodeData.jurisdiction ? countryFlagEmoji(nodeData.jurisdiction) : '';
    const jurName = getJurisdictionName(nodeData.jurisdiction);
    nodeEl.innerHTML = `
        <span class="flag">${flag}</span>
        <div class="company-name">${nodeData.name || 'Unnamed'}</div>
        <div class="jurisdiction">${jurName}</div>
    `;

    canvas.appendChild(nodeEl);
    if (window.twemoji) twemoji.parse(nodeEl);
    chartNodes.set(nodeData.id, nodeData); // Add to our state map

    // Make the node draggable (simple implementation)
    makeDraggable(nodeEl);

    nodeEl.addEventListener('click', () => {
        if (connectMode) {
            if (!connectParentId) {
                connectParentId = nodeData.id;
                nodeEl.classList.add('selected');
            } else {
                if (connectParentId !== nodeData.id) {
                    const childData = chartNodes.get(nodeData.id);
                    childData.parent_id = connectParentId;
                    redrawLines();
                    updateTreeView();
                }
                document.querySelectorAll('.chart-node.selected').forEach(el => el.classList.remove('selected'));
                connectParentId = null;
                connectMode = false;
            }
        } else {
            document.querySelectorAll('.chart-node.selected').forEach(el => el.classList.remove('selected'));
            selectedNodeId = nodeData.id;
            nodeEl.classList.add('selected');
        }
    });
    
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

function redrawLines() {
    chartLines.forEach(l => l.remove());
    chartLines = [];
    chartNodes.forEach(node => {
        if (node.parent_id && chartNodes.has(node.parent_id)) {
        const parentEl = document.getElementById(`node-${safeId(node.parent_id)}`);
        const childEl = document.getElementById(`node-${safeId(node.id)}`);
            const label = LeaderLine.pathLabel(`${node.ownership || 100}%`);
            label.style.fontSize = '14px';
            const options = {
                color: '#007bff',
                size: 2,
                path: 'straight',
                startSocket: 'bottom',
                endSocket: 'top',
                middleLabel: label
            };
            if (node.ownership && node.ownership < 100) {
                options.dash = {len: 4, gap: 4};
            }
            const line = new LeaderLine(parentEl, childEl, options);
            if (line.middleLabel && line.middleLabel.nodeType === 1) {
                line.middleLabel.style.transform = `scale(${1 / canvasScale})`;
            }
            chartLines.push(line);
        }
    });
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
    let text = document.getElementById('csvtext').value.trim();
    const fileInput = document.getElementById('csvfile');
    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        text = await file.text();
        document.getElementById('csvtext').value = text;
    }
    if (!text) {
        showError('CSV data is empty.');
        return;
    }
    try {
        const records = parseCsvText(text);
        currentCsvText = text;
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
    updateTreeView();
    redrawLines();
}

function handleChangeJurisdiction() {
    if (!selectedNodeId) return;
    const input = document.getElementById('jurisdiction-input');
    if (!input) return;
    const value = input.value.trim();
    if (!value) return;
    let code = value.toUpperCase();
    if (!countryNames[code]) {
        code = Object.keys(countryNames).find(c => countryNames[c].toLowerCase() === value.toLowerCase());
    }
    if (!code) {
        showError('Unknown jurisdiction');
        return;
    }
    const node = chartNodes.get(selectedNodeId);
    node.jurisdiction = code;
    const el = document.getElementById(`node-${safeId(selectedNodeId)}`);
    if (el) {
        el.querySelector('.flag').textContent = countryFlagEmoji(code);
        el.querySelector('.jurisdiction').textContent = getJurisdictionName(code);
        if (window.twemoji) twemoji.parse(el);
    }
    input.value = '';
    updateTreeView();
}

function handleChangeName() {
    if (!selectedNodeId) return;
    const input = document.getElementById('company-name-input');
    if (!input) return;
    const value = input.value.trim();
    if (!value) return;
    const node = chartNodes.get(selectedNodeId);
    node.name = value;
    const el = document.getElementById(`node-${safeId(selectedNodeId)}`);
    if (el) {
        el.querySelector('.company-name').textContent = value;
    }
    input.value = '';
    updateTreeView();
}

function handleChangeOwnership() {
    if (!selectedNodeId) return;
    const input = document.getElementById('ownership-input');
    if (!input) return;
    const value = input.value.trim();
    if (value === '') return;
    const percent = parseFloat(value);
    if (isNaN(percent) || percent < 0 || percent > 100) {
        showError('Ownership must be between 0 and 100');
        return;
    }
    const node = chartNodes.get(selectedNodeId);
    node.ownership = percent;
    input.value = '';
    redrawLines();
    updateTreeView();
}

function toggleConnectMode() {
    connectMode = !connectMode;
    connectParentId = null;
    document.querySelectorAll('.chart-node.selected').forEach(el => el.classList.remove('selected'));
}

function zoomCanvas(delta) {
    canvasScale = Math.max(0.2, Math.min(3, canvasScale + delta));
    document.getElementById('canvas').style.transform = `scale(${canvasScale})`;
    chartLines.forEach(line => {
        line.position();
        if (line.middleLabel && line.middleLabel.nodeType === 1) {
            line.middleLabel.style.transform = `scale(${1 / canvasScale})`;
        }
    });
    const disp = document.getElementById('zoom-display');
    if (disp) disp.textContent = Math.round(canvasScale * 100) + '%';
}

function initCanvasPan() {
    const canvas = document.getElementById('canvas');
    let isPanning = false;
    let startX = 0, startY = 0, scrollLeft = 0, scrollTop = 0;
    canvas.addEventListener('mousedown', e => {
        if (e.target === canvas) {
            isPanning = true;
            startX = e.clientX;
            startY = e.clientY;
            scrollLeft = canvas.scrollLeft;
            scrollTop = canvas.scrollTop;
            canvas.style.cursor = 'grabbing';
        }
    });
    document.addEventListener('mousemove', e => {
        if (!isPanning) return;
        canvas.scrollLeft = scrollLeft - (e.clientX - startX);
        canvas.scrollTop = scrollTop - (e.clientY - startY);
    });
    document.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            canvas.style.cursor = 'grab';
        }
    });
}


// --- REVISED: Update DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    loadCountryNames();

    // NEW event listeners
    document.getElementById('import-from-csv').addEventListener('click', handleImport);
    document.getElementById('export-csv').addEventListener('click', exportToCsv);
    document.getElementById('add-node').addEventListener('click', handleAddNode);
    document.getElementById('connect-nodes').addEventListener('click', toggleConnectMode);
    document.getElementById('change-jurisdiction').addEventListener('click', handleChangeJurisdiction);
    document.getElementById('change-name').addEventListener('click', handleChangeName);
    document.getElementById('change-ownership').addEventListener('click', handleChangeOwnership);
    document.getElementById('zoom-in').addEventListener('click', () => zoomCanvas(0.1));
    document.getElementById('zoom-out').addEventListener('click', () => zoomCanvas(-0.1));
    initCanvasPan();

    if (window.twemoji) twemoji.parse(document.body);

    const initial = document.getElementById('csvtext').value.trim();
    if (initial) {
        handleImport();
    }
});
