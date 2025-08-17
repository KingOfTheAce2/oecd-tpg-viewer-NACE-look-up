import { JSDOM } from 'jsdom';
import { layoutGrid } from '../docs/assets/chartpal/layout.js';

test('layoutGrid positions nodes', () => {
  const dom = new JSDOM(`<div id="chart"><div id="node-1"></div><div id="node-2"></div></div>`);
  global.document = dom.window.document;
  const chartNodes = new Map([
    ['1', { id: '1', parent_id: '0', name: 'Root' }],
    ['2', { id: '2', parent_id: '1', name: 'Child' }]
  ]);
  layoutGrid(chartNodes, id => id, () => {}, 100, 100);
  const node1 = document.getElementById('node-1');
  const node2 = document.getElementById('node-2');
  expect(node1.style.left).not.toBe('');
  expect(node2.style.top).not.toBe('');
});
