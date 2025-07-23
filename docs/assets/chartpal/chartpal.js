// ChartPal - ASCII/Unicode Organisational Chart Builder
let countryNames = {};
let currentCsvText = '';
let currentZoom = 100; // Zoom level in percent
// --- History & Selection ---
let undoStack = [];
let redoStack = [];
let selectedNodeIds = new Set();

function pushHistory(action) {
    undoStack.push(action);
    redoStack = [];
    saveChartLocal();
}

function undo() {
    const action = undoStack.pop();
    if (!action) return;
    redoStack.push(action);
    applyHistory(action, true);
    saveChartLocal();
}

function redo() {
    const action = redoStack.pop();
    if (!action) return;
    undoStack.push(action);
    applyHistory(action, false);
    saveChartLocal();
}

function applyHistory(action, isUndo) {
    switch (action.type) {
        case 'add':
            if (isUndo) {
                removeNodeById(action.node.id);
            } else {
                renderNode({...action.node}, action.node.x, action.node.y);
            }
            break;
        case 'delete':
            if (isUndo) {
                action.nodes.forEach(n => renderNode({...n}, n.x, n.y));
            } else {
                action.nodes.forEach(n => removeNodeById(n.id));
            }
            break;
        case 'move':
            action.moves.forEach(m => {
                const el = document.getElementById(`node-${safeId(m.id)}`);
                if (el) {
                    const node = chartNodes.get(m.id);
                    const x = isUndo ? m.fromX : m.toX;
                    const y = isUndo ? m.fromY : m.toY;
                    el.style.left = x + 'px';
                    el.style.top = y + 'px';
                    node.x = x;
                    node.y = y;
                }
            });
            redrawLines();
            break;
        case 'connect':
            const node = chartNodes.get(action.childId);
            if (node) {
                node.parent_id = isUndo ? action.oldParent : action.newParent;
                redrawLines();
                updateTreeView();
            }
            break;
    }
}

function saveChartLocal() {
    const data = JSON.stringify(Array.from(chartNodes.values()));
    localStorage.setItem('chartpal-data', data);
}

function loadChartLocal() {
    const data = localStorage.getItem('chartpal-data');
    if (data) {
        const records = JSON.parse(data);
        drawChartFromData(records);
    }
}

function resetChart() {
    chartNodes.clear();
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '';
    chartLines.forEach(l => l.remove());
    chartLines = [];
    undoStack = [];
    redoStack = [];
    localStorage.removeItem('chartpal-data');
    updateTreeView();
}

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
        const x = rec.x !== undefined ? parseFloat(rec.x) : undefined;
        const y = rec.y !== undefined ? parseFloat(rec.y) : undefined;
        nodes.set(rec.id, { ...rec, x, y, children: [] });
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
        li.textContent = `${countryFlagEmoji(code)} ${name}`;
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
    updateCsvText();
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
        const x = typeof nodeData.x === 'number' ? nodeData.x : 30;
        const y = typeof nodeData.y === 'number' ? nodeData.y : yPos;
        renderNode(nodeData, x, y);
        yPos = y + 150; // Stagger next root
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
            path: 'grid',
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
            line.middleLabel.style.pointerEvents = 'none';
        }
        if (line.line) line.line.style.pointerEvents = 'none';
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
    if (nodeData.isBranch) nodeEl.classList.add('branch-node');
    nodeEl.dataset.id = nodeData.id;
    nodeEl.style.left = `${x}px`;
    nodeEl.style.top = `${y}px`;
    nodeData.x = x;
    nodeData.y = y;

    // Populate the box content
    if (nodeData.isBranch) {
        nodeEl.textContent = nodeData.name || 'Branch';
    } else {
        const flag = nodeData.jurisdiction ? countryFlagEmoji(nodeData.jurisdiction) : '';
        const jurName = getJurisdictionName(nodeData.jurisdiction);
        nodeEl.innerHTML = `
            <span class="flag">${flag}</span>
            <div class="company-name">${nodeData.name || 'Unnamed'}</div>
            <div class="jurisdiction">${jurName}</div>
        `;
    }

    canvas.appendChild(nodeEl);
    if (window.twemoji) twemoji.parse(nodeEl);
    chartNodes.set(nodeData.id, nodeData); // Add to our state map

    // Make the node draggable (simple implementation)
    makeDraggable(nodeEl);

    nodeEl.addEventListener('click', (e) => {
        if (connectMode) {
            if (!connectParentId) {
                connectParentId = nodeData.id;
                nodeEl.classList.add('selected');
            } else {
                if (connectParentId !== nodeData.id) {
                    const childData = chartNodes.get(nodeData.id);
                    const old = childData.parent_id || null;
                    childData.parent_id = connectParentId;
                    redrawLines();
                    updateTreeView();
                    pushHistory({type:'connect', childId: nodeData.id, oldParent: old, newParent: connectParentId});
                }
                document.querySelectorAll('.chart-node.selected').forEach(el => el.classList.remove('selected'));
                connectParentId = null;
                connectMode = false;
            }
        } else {
            if (!e.shiftKey && !e.ctrlKey) {
                document.querySelectorAll('.chart-node.selected').forEach(el => el.classList.remove('selected'));
                selectedNodeIds.clear();
            }
            if (selectedNodeIds.has(nodeData.id)) {
                selectedNodeIds.delete(nodeData.id);
                nodeEl.classList.remove('selected');
            } else {
                selectedNodeIds.add(nodeData.id);
                nodeEl.classList.add('selected');
            }
            selectedNodeId = nodeData.id;
        }
    });
    
    // Render children recursively (simple vertical layout)
    let childY = y + 150;
    let childX = x + 50;
    if (nodeData.children) {
        nodeData.children.forEach(child => {
            const cx = typeof child.x === 'number' ? child.x : childX;
            const cy = typeof child.y === 'number' ? child.y : childY;
            renderNode(child, cx, cy);
            childY = cy + 150; // Adjust spacing as needed
        });
    }
}

// --- Utility to make an element draggable ---
function makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let startPositions = new Map();
    element.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
        const ids = selectedNodeIds.size && selectedNodeIds.has(element.dataset.id) ? selectedNodeIds : new Set([element.dataset.id]);
        startPositions.clear();
        ids.forEach(id => {
            const el = document.getElementById(`node-${safeId(id)}`);
            startPositions.set(id, {x: el.offsetLeft, y: el.offsetTop});
        });
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        const ids = selectedNodeIds.size && selectedNodeIds.has(element.dataset.id) ? selectedNodeIds : new Set([element.dataset.id]);
        ids.forEach(id => {
            const el = document.getElementById(`node-${safeId(id)}`);
            el.style.top = (el.offsetTop - pos2) + "px";
            el.style.left = (el.offsetLeft - pos1) + "px";
            const node = chartNodes.get(id);
            node.x = el.offsetLeft;
            node.y = el.offsetTop;
        });
        chartLines.forEach(line => line.position());
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
        const ids = selectedNodeIds.size && selectedNodeIds.has(element.dataset.id) ? selectedNodeIds : new Set([element.dataset.id]);
        const moves = [];
        ids.forEach(id => {
            const start = startPositions.get(id);
            const el = document.getElementById(`node-${safeId(id)}`);
            moves.push({id, fromX:start.x, fromY:start.y, toX:el.offsetLeft, toY:el.offsetTop});
        });
        if (moves.length) pushHistory({type:'move', moves});
    }
}

function removeNodeById(id) {
    const el = document.getElementById(`node-${safeId(id)}`);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    chartNodes.delete(id);
    chartLines = chartLines.filter(line => {
        if (line.start && line.end) {
            const sid = line.start.id.replace('node-','');
            const eid = line.end.id.replace('node-','');
            if (sid === safeId(id) || eid === safeId(id)) {
                line.remove();
                return false;
            }
        }
        return true;
    });
    redrawLines();
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
                path: 'grid',
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
                line.middleLabel.style.pointerEvents = 'none';
            }
            if (line.line) line.line.style.pointerEvents = 'none';
            chartLines.push(line);
        }
    });
}

// --- NEW: Functions to keep CSV text in sync and to export ---
function generateCsvText() {
    const headers = "id,parent_id,name,ownership%,jurisdiction";
    let csvContent = [headers];

    chartNodes.forEach(node => {
        const row = [
            node.id,
            node.parent_id || '0',
            `\"${node.name}\"`,
            node.ownership || '',
            node.jurisdiction || ''
        ].join(',');
        csvContent.push(row);
    });
    return csvContent.join('\n');
}

function updateCsvText() {
    const csvText = generateCsvText();
    const area = document.getElementById('csvtext');
    if (area) area.value = csvText;
}

function exportToCsv() {
    const csvText = generateCsvText();
    document.getElementById('csvtext').value = csvText;

    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'org-chart-export.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function exportJson() {
    const data = JSON.stringify(Array.from(chartNodes.values()), null, 2);
    const blob = new Blob([data], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chart.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importJson(evt) {
    const file = evt.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        const records = JSON.parse(reader.result);
        drawChartFromData(records);
    };
    reader.readAsText(file);
    evt.target.value = '';
}

function saveVersion() {
    const nameInput = document.getElementById('version-name');
    if (!nameInput) return;
    const name = nameInput.value.trim();
    if (!name) return;
    const data = JSON.stringify(Array.from(chartNodes.values()));
    localStorage.setItem('chartpal-version-' + name, data);
    updateVersionList();
    nameInput.value = '';
}

function loadVersion(name) {
    const data = localStorage.getItem('chartpal-version-' + name);
    if (!data) return;
    const records = JSON.parse(data);
    drawChartFromData(records);
}

function updateVersionList() {
    const select = document.getElementById('version-list');
    if (!select) return;
    select.innerHTML = '';
    Object.keys(localStorage).forEach(k => {
        if (k.startsWith('chartpal-version-')) {
            const name = k.replace('chartpal-version-','');
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            select.appendChild(opt);
        }
    });
}

function exportImage(type) {
    const node = document.getElementById('canvas');
    html2canvas(node).then(canvas => {
        if (type === 'png') {
            const data = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = data;
            a.download = 'chart.png';
            a.click();
        } else {
            const png = canvas.toDataURL('image/png');
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvas.width}" height="${canvas.height}"><image href="${png}" width="${canvas.width}" height="${canvas.height}"/></svg>`;
            const blob = new Blob([svg], {type:'image/svg+xml'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'chart.svg';
            a.click();
            URL.revokeObjectURL(url);
        }
    });
}

function handleDeleteSelected() {
    if (selectedNodeIds.size === 0) return;
    const nodes = [];
    selectedNodeIds.forEach(id => {
        const node = chartNodes.get(id);
        if (node) nodes.push({...node});
        removeNodeById(id);
    });
    pushHistory({type:'delete', nodes});
    selectedNodeIds.clear();
    updateTreeView();
}

function handleShortcuts(e) {
    if (e.ctrlKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); return; }
    if ((e.ctrlKey && e.key.toLowerCase() === 'y') || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) { e.preventDefault(); redo(); return; }
    if (e.key === 'Delete') { e.preventDefault(); handleDeleteSelected(); return; }
    if (e.key.toLowerCase() === 'n') { e.preventDefault(); handleAddNode(); return; }
    if (e.key.toLowerCase() === 'b') { e.preventDefault(); handleAddBranch(); return; }
    if (e.key.toLowerCase() === 'c') { e.preventDefault(); toggleConnectMode(); return; }
    if (e.key === '+') { e.preventDefault(); zoomCanvas(0.1); return; }
    if (e.key === '-') { e.preventDefault(); zoomCanvas(-0.1); return; }
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
    pushHistory({type:'add', node:{...newNodeData, x:50, y:50}});

    // Also update the tree view
    updateTreeView();
    redrawLines();
}

function handleAddBranch() {
    const newId = (Math.max(0, ...Array.from(chartNodes.keys()).map(k => parseInt(k))) + 1).toString();
    const newNodeData = {
        id: newId,
        parent_id: '0',
        name: `Branch ${newId}`,
        isBranch: true,
        children: []
    };
    renderNode(newNodeData, 50, 50);
    pushHistory({type:'add', node:{...newNodeData, x:50, y:50}});
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

function layoutGrid() {
    // Rebuild hierarchy from current node data
    const hierarchy = buildHierarchy(Array.from(chartNodes.values()));

    let startY = 30;
    function positionNode(node, x, y) {
        const el = document.getElementById(`node-${safeId(node.id)}`);
        if (el) {
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
        }
        let childY = y + 150;
        node.children.forEach(child => {
            positionNode(child, x + 200, childY);
            childY += 150;
        });
    }

    hierarchy.children.forEach(node => {
        positionNode(node, 30, startY);
        startY += 150;
    });

    redrawLines();
}

function setZoom(percent) {
    canvasScale = Math.max(20, Math.min(300, percent)) / 100;
    document.getElementById('canvas').style.transform = `scale(${canvasScale})`;
    chartLines.forEach(line => {
        line.position();
        if (line.middleLabel && line.middleLabel.nodeType === 1) {
            line.middleLabel.style.transform = `scale(${1 / canvasScale})`;
        }
    });
    const input = document.getElementById('zoom-input');
    if (input) input.value = Math.round(canvasScale * 100);
    redrawLines();
}

function zoomCanvas(delta) {
    setZoom(canvasScale * 100 + delta * 100);
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
    document.getElementById('export-png').addEventListener('click', () => exportImage('png'));
    document.getElementById('export-svg').addEventListener('click', () => exportImage('svg'));
    document.getElementById('save-json').addEventListener('click', exportJson);
    document.getElementById('load-json').addEventListener('click', () => {
        document.getElementById('jsonfile').click();
    });
    document.getElementById('jsonfile').addEventListener('change', importJson);
    document.getElementById('undo-action').addEventListener('click', undo);
    document.getElementById('redo-action').addEventListener('click', redo);
    document.getElementById('delete-node').addEventListener('click', handleDeleteSelected);
    document.getElementById('reset-chart').addEventListener('click', resetChart);
    document.getElementById('add-node').addEventListener('click', handleAddNode);
    const branchBtn = document.getElementById('add-branch');
    if (branchBtn) branchBtn.addEventListener('click', handleAddBranch);
    document.getElementById('connect-nodes').addEventListener('click', toggleConnectMode);
    document.getElementById('change-jurisdiction').addEventListener('click', handleChangeJurisdiction);
    document.getElementById('change-name').addEventListener('click', handleChangeName);
    document.getElementById('change-ownership').addEventListener('click', handleChangeOwnership);
    document.getElementById('zoom-in').addEventListener('click', () => zoomCanvas(0.1));
    document.getElementById('zoom-out').addEventListener('click', () => zoomCanvas(-0.1));
    const zoomInput = document.getElementById('zoom-input');
    if (zoomInput) {
        zoomInput.addEventListener('change', () => {
            const val = parseFloat(zoomInput.value);
            if (!isNaN(val)) setZoom(val);
        });
    }
    document.getElementById('save-version').addEventListener('click', saveVersion);
    document.getElementById('load-version-btn').addEventListener('click', () => {
        const sel = document.getElementById('version-list');
        if (sel && sel.value) loadVersion(sel.value);
    });
    updateVersionList();
    document.getElementById('layout-grid').addEventListener('click', layoutGrid);
    initCanvasPan();

    document.addEventListener('keydown', handleShortcuts);

    loadChartLocal();

    if (window.twemoji) twemoji.parse(document.body);

    const initial = document.getElementById('csvtext').value.trim();
    if (initial) {
        handleImport();
    }
});
