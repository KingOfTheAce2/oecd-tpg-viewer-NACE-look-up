export function parseCsvText(text) {
  const result = Papa.parse(text.trim(), { header: true, skipEmptyLines: true });
  if (result.errors.length > 0) {
    console.error('CSV Parsing Errors:', result.errors);
    throw new Error(`CSV Error: ${result.errors[0].message} on row ${result.errors[0].row}.`);
  }
  return result.data.map((r, idx) => {
    const rec = {};
    Object.entries(r).forEach(([k, v]) => (rec[k.trim().toLowerCase()] = v));
    if (rec.type) {
      const t = String(rec.type).toLowerCase();
      if (t === 'branch') rec.isBranch = true;
      if (t === 'person') rec.isPerson = true;
    }
    if (!rec.parent_id) rec.parent_id = '0';
    let ownVal = rec['ownership%'] || rec['ownership'] || '';
    if (ownVal !== '') {
      ownVal = String(ownVal).trim().replace('%', '');
      if (!isNaN(ownVal)) rec.ownership = parseFloat(ownVal);
    }
    rec.id = rec.id || '';
    if (String(rec.id).trim() === '') {
      throw new Error(`CSV Error: Missing id on row ${idx + 2}`);
    }
    return rec;
  });
}

export function buildHierarchy(records) {
  const nodes = new Map();
  records.forEach((rec, idx) => {
    if (!rec.id || String(rec.id).trim() === '') {
      throw new Error(`Record at index ${idx} missing id`);
    }
    if (nodes.has(rec.id)) {
      throw new Error(`Duplicate id '${rec.id}' detected`);
    }
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
