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

function buildHierarchy(records) {
  const stratify = d3.stratify().id(d => d.id).parentId(d => d.parent);
  return stratify(records);
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
      .attr('stroke-width', 3)
    .selectAll('g')
    .data(rootHier.descendants())
    .join('g')
      .attr('transform', d => `translate(${d.y},${d.x})`);

  node.append('circle')
      .attr('fill', d => d.children ? '#555' : '#999')
      .attr('r', 4);

  node.append('text')
      .attr('dy', '0.31em')
      .attr('x', d => d.children ? -6 : 6)
      .attr('text-anchor', d => d.children ? 'end' : 'start')
      .text(d => d.name)
    .clone(true).lower()
      .attr('stroke', 'white');
}

async function handleGenerate() {
  const file = document.getElementById('csvfile').files[0];
  if (!file) {
    alert('Please select a CSV file with id,parent,name columns.');
    return;
  }
  try {
    const records = await readCsv(file);
    const root = buildHierarchy(records);
    drawChart(root);
  } catch(err) {
    alert('Failed to parse CSV: ' + err);
  }
}

document.getElementById('generate').addEventListener('click', handleGenerate);
