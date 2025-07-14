function readCsv(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject('No file provided');
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      const rows = text.trim().split(/\r?\n/).map(r => r.split(','));
      const headers = rows.shift();
      const data = rows.map(r => {
        const obj = {};
        headers.forEach((h,i) => obj[h.trim()] = r[i] ? r[i].trim() : '');
        return obj;
      });
      resolve(data);
    };
    reader.onerror = () => reject('Failed to read file');
    reader.readAsText(file);
  });
}

function parseOwnership(value) {
  if (!value && value !== 0) return null;
  let v = value.toString().trim();
  if (v.endsWith('%')) v = v.slice(0, -1);
  let num = parseFloat(v);
  if (isNaN(num)) return null;
  if (num <= 1) num = num * 100;
  return Math.round(num * 100) / 100; // keep two decimals
}

function buildHierarchy(records) {
  records.forEach(rec => {
    if (rec['ownership%'] !== undefined) {
      const val = parseOwnership(rec['ownership%']);
      if (val !== null) rec['ownership%'] = val;
    }
  });
  const stratify = d3.stratify().id(d => d.id).parentId(d => d.parent_id);
  return stratify(records);
}

function countryFlagEmoji(code) {
  if (!code || code.length !== 2) return '';
  const base = 127397;
  return String.fromCodePoint(
    base + code.toUpperCase().charCodeAt(0),
    base + code.toUpperCase().charCodeAt(1)
  );
}

function drawChart(root) {
  d3.select('#chart').selectAll('*').remove();
  const width = 800;
  const dx = 10;
  const dy = width / 6;
  const tree = d3.tree().nodeSize([dx, dy]);
  const rootHier = tree(root);
  let x0 = Infinity;
  let x1 = -x0;
  rootHier.each(d => {
    if (d.x > x1) x1 = d.x;
    if (d.x < x0) x0 = d.x;
  });
  const svg = d3.select('#chart').append('svg')
      .attr('viewBox', [0, 0, width, x1 - x0 + dx * 2])
      .style('font', '10px sans-serif')
      .style('user-select', 'none');

  const g = svg.append('g').attr('transform', `translate(${dy / 3},${dx - x0})`);

  const link = g.append('g')
      .attr('fill', 'none')
      .attr('stroke', '#555')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5)
    .selectAll('path')
    .data(rootHier.links())
    .join('path')
      .attr('d', d3.linkHorizontal()
          .x(d => d.y)
          .y(d => d.x));

  const node = g.append('g')
      .attr('stroke-linejoin', 'round')
      .attr('stroke-width', 1.5)
    .selectAll('g')
    .data(rootHier.descendants())
    .join('g')
      .attr('transform', d => `translate(${d.y},${d.x})`);

  node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.31em')
      .text(d => {
        let label = d.data.name || d.id;
        if (d.data['ownership%'] !== undefined && d.data['ownership%'] !== null) {
          label += ` (${d.data['ownership%']}%)`;
        }
        if (d.data.jurisdiction) {
          const flag = countryFlagEmoji(d.data.jurisdiction);
          label = `${flag} ${label}`;
        }
        return label;
      });

  node.each(function(d) {
    const text = d3.select(this).select('text');
    const bbox = text.node().getBBox();
    d3.select(this)
      .insert('rect', 'text')
        .attr('x', bbox.x - 4)
        .attr('y', bbox.y - 2)
        .attr('width', bbox.width + 8)
        .attr('height', bbox.height + 4)
        .attr('fill', '#fff')
        .attr('stroke', '#555');
  });

  node.select('text')
      .clone(true).lower()
      .attr('stroke', 'white');
}

function parseCsvText(text) {
  const rows = text.trim().split(/\r?\n/).map(r => r.split(','));
  const headers = rows.shift();
  return rows.map(r => {
    const obj = {};
    headers.forEach((h,i) => obj[h.trim()] = r[i] ? r[i].trim() : '');
    return obj;
  });
}

async function handleGenerate() {
  const file = document.getElementById('csvfile').files[0];
  const text = document.getElementById('csvtext').value.trim();
  if (!file && !text) {
    alert('Please provide a CSV file or paste data with id,parent_id,name,ownership%,jurisdiction columns.');
    return;
  }
  try {
    const records = file ? await readCsv(file) : parseCsvText(text);
    const root = buildHierarchy(records);
    drawChart(root);
  } catch(err) {
    alert('Failed to parse CSV: ' + err);
  }
}

  document.getElementById('generate').addEventListener('click', handleGenerate);

function downloadSvg() {
  const svg = document.querySelector('#chart svg');
  if (!svg) return;
  const blob = new Blob([svg.outerHTML], {type: 'image/svg+xml'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chart.svg';
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPng() {
  const svg = document.querySelector('#chart svg');
  if (!svg) return;
  saveSvgAsPng(svg, 'chart.png');
}

function downloadPptx() {
  const svg = document.querySelector('#chart svg');
  if (!svg) return;
  saveSvgAsPng(svg, null, {encoderType:'image/png'}).then(dataUrl => {
    const pptx = new PptxGenJS();
    const slide = pptx.addSlide();
    slide.addImage({data:dataUrl, x:0.5, y:0.5, w:9, h:5});
    pptx.writeFile('chart.pptx');
  });
}

document.getElementById('download-svg').addEventListener('click', downloadSvg);
document.getElementById('download-png').addEventListener('click', downloadPng);
document.getElementById('download-pptx').addEventListener('click', downloadPptx);
