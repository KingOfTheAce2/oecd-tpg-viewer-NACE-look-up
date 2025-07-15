// Minimal ASCII-based organisational chart builder
let currentCsvText = '';
const countryNames = {
  US: 'United States',
  DE: 'Germany',
  GB: 'United Kingdom',
  FR: 'France',
  ES: 'Spain',
  IT: 'Italy',
  NL: 'Netherlands',
  BE: 'Belgium'
};

function readCsv(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject('No file provided');
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject('Failed to read file');
    reader.readAsText(file);
  });
}

function parseCsvText(text) {
  const rows = text.trim().split(/\r?\n/).map(r => r.split(','));
  const headers = rows.shift();
  return rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim()] = r[i] ? r[i].trim() : '';
    });
    return obj;
  });
}

function parseOwnership(value) {
  if (!value && value !== 0) return null;
  let v = value.toString().trim();
  if (v.endsWith('%')) v = v.slice(0, -1);
  let num = parseFloat(v);
  if (isNaN(num)) return null;
  if (num <= 1) num = num * 100;
  return Math.round(num * 100) / 100;
}

function buildHierarchy(records) {
  const nodes = new Map();
  records.forEach(rec => {
    if (rec['ownership%'] !== undefined) {
      const val = parseOwnership(rec['ownership%']);
      if (val !== null) rec['ownership%'] = val;
    }
    nodes.set(rec.id, Object.assign({}, rec, { children: [] }));
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

function countryFlagEmoji(code) {
  if (!code || code.length !== 2) return '';
  const base = 127397;
  return String.fromCodePoint(
    base + code.toUpperCase().charCodeAt(0),
    base + code.toUpperCase().charCodeAt(1)
  );
}

function asciiTree(root) {
  const lines = [];
  function walk(node, prefix, isRoot, isLast) {
    const flag = node.jurisdiction ? countryFlagEmoji(node.jurisdiction) + ' ' : '';
    const own = node['ownership%'] !== undefined && node['ownership%'] !== null ? ` (${node['ownership%']}%)` : '';
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

function updateCountryDropdown(records) {
  const dropdown = document.getElementById('country-info');
  dropdown.innerHTML = '';
  const codes = Array.from(new Set(records.map(r => r.jurisdiction).filter(Boolean)));
  codes.forEach(code => {
    const option = document.createElement('option');
    const name = countryNames[code.toUpperCase()] || '';
    option.value = code;
    option.textContent = `${countryFlagEmoji(code)} ${code}${name ? ' - ' + name : ''}`;
    dropdown.appendChild(option);
  });
}

async function handleGenerate() {
  const file = document.getElementById('csvfile').files[0];
  const textArea = document.getElementById('csvtext');
  let text = textArea.value.trim();
  try {
    if (file) text = await readCsv(file);
    if (!text) {
      alert('Please provide CSV data.');
      return;
    }
    currentCsvText = text;
    const records = parseCsvText(text);
    const root = buildHierarchy(records);
    document.getElementById('ascii-chart').textContent = asciiTree(root);
    updateCountryDropdown(records);
  } catch (err) {
    alert('Failed to parse CSV: ' + err);
  }
}

document.getElementById('generate').addEventListener('click', handleGenerate);

function downloadCsv() {
  if (!currentCsvText) return;
  const blob = new Blob([currentCsvText], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chart.csv';
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('download-csv').addEventListener('click', downloadCsv);

