// JS for Sankey Diagram Generator
// Handles parsing input, rendering the chart, exporting data and image

document.addEventListener('DOMContentLoaded', function () {
  const textarea = document.getElementById('data-input');
  const renderBtn = document.getElementById('render-btn');
  const dropZone = document.getElementById('drop-zone');
  const errorBox = document.getElementById('error');
  const nodeColorInput = document.getElementById('nodeColor');
  const linkColorInput = document.getElementById('linkColor');
  const fontSizeInput = document.getElementById('fontSize');
  const orientationInput = document.getElementById('orientation');
  const widthInput = document.getElementById('chartWidth');
  const heightInput = document.getElementById('chartHeight');
  const exportCsvBtn = document.getElementById('export-csv');
  const exportJsonBtn = document.getElementById('export-json');
  const exportPngBtn = document.getElementById('export-png');
  const chartDiv = document.getElementById('chart');

  let chart;
  let chartData = [];

  // sample data shown on load
  const defaultData = [
    { source: 'Revenue', target: 'Cost of Goods Sold', value: 400 },
    { source: 'Revenue', target: 'Gross Margin', value: 600 },
    { source: 'Gross Margin', target: 'Operating Expenses', value: 300 },
    { source: 'Gross Margin', target: 'Gross Profit', value: 300 },
    { source: 'Gross Profit', target: 'Taxes', value: 100 },
    { source: 'Gross Profit', target: 'Net Profit', value: 200 }
  ];

  // helpers
  const toCSV = (data) => data.map(d => `${d.source},${d.target},${d.value}`).join('\n');

  const showError = (msg) => { errorBox.textContent = msg; };
  const clearError = () => { errorBox.textContent = ''; };

  // parse input as JSON or CSV
  function parseInput(text) {
    text = text.trim();
    if (!text) return { data: [] };
    try {
      const obj = JSON.parse(text);
      if (Array.isArray(obj)) return { data: obj };
      return { error: 'JSON must be an array of objects' };
    } catch (e) {
      // try CSV
      const lines = text.split(/\r?\n/).filter(Boolean);
      const arr = [];
      for (const line of lines) {
        const parts = line.split(',');
        if (parts.length !== 3) return { error: 'Invalid CSV format' };
        const value = parseFloat(parts[2]);
        if (isNaN(value)) return { error: 'CSV values must be numbers' };
        arr.push({ source: parts[0].trim(), target: parts[1].trim(), value });
      }
      return { data: arr };
    }
  }

  // check that for intermediate nodes inputs equal outputs
  function validateData(data) {
    const map = {};
    data.forEach(({ source, target, value }) => {
      map[source] = map[source] || { in: 0, out: 0 };
      map[source].out += value;
      map[target] = map[target] || { in: 0, out: 0 };
      map[target].in += value;
    });
    const issues = Object.keys(map).filter(k => map[k].in > 0 && map[k].out > 0 && Math.abs(map[k].in - map[k].out) > 0.001);
    return issues;
  }

  // render the Google Charts Sankey
  function drawChart(data) {
    const rows = [['From', 'To', 'Weight']];
    data.forEach(d => rows.push([d.source, d.target, d.value]));
    const dataTable = google.visualization.arrayToDataTable(rows);
    chartDiv.style.width = widthInput.value ? widthInput.value + 'px' : '100%';
    chartDiv.style.height = heightInput.value ? heightInput.value + 'px' : '500px';
    const options = {
      width: widthInput.value ? parseInt(widthInput.value, 10) : chartDiv.clientWidth,
      height: heightInput.value ? parseInt(heightInput.value, 10) : parseInt(chartDiv.style.height, 10),
      sankey: {
        orientation: orientationInput.value === 'vertical' ? 'vertical' : 'horizontal',
        node: {
          color: nodeColorInput.value,
          label: { fontSize: parseInt(fontSizeInput.value, 10) || 12 }
        },
        link: { color: linkColorInput.value }
      }
    };
    chart = new google.visualization.Sankey(chartDiv);
    chart.draw(dataTable, options);
  }

  // handle drag & drop
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      textarea.value = reader.result.trim();
      const { data, error } = parseInput(textarea.value);
      if (error) { showError(error); return; }
      const issues = validateData(data);
      if (issues.length) {
        showError('Flow mismatch at nodes: ' + issues.join(', '));
        return;
      }
      clearError();
      chartData = data;
      drawChart(chartData);
    };
    reader.readAsText(file);
  });

  // export helpers
  function download(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exportCsvBtn.addEventListener('click', () => {
    download(toCSV(chartData), 'data.csv', 'text/csv');
  });
  exportJsonBtn.addEventListener('click', () => {
    download(JSON.stringify(chartData, null, 2), 'data.json', 'application/json');
  });
  exportPngBtn.addEventListener('click', () => {
    if (!chart) return;
    const uri = chart.getImageURI();
    const a = document.createElement('a');
    a.href = uri;
    a.download = 'chart.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  // handle render button
  renderBtn.addEventListener('click', () => {
    const { data, error } = parseInput(textarea.value);
    if (error) { showError(error); return; }
    const issues = validateData(data);
    if (issues.length) {
      showError('Flow mismatch at nodes: ' + issues.join(', '));
      return;
    }
    clearError();
    chartData = data;
    drawChart(chartData);
  });

  // load google charts and draw default
  google.charts.load('current', { packages: ['sankey'] });
  google.charts.setOnLoadCallback(() => {
    chartData = defaultData;
    textarea.value = toCSV(defaultData);
    drawChart(defaultData);
  });
});
