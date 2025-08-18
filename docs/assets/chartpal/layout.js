import { buildHierarchy } from './parser.js';

export function layoutGrid(chartNodes, safeId, redrawLines = () => {}, spacingX = 200, spacingY = 200) {
  const hierarchy = buildHierarchy(Array.from(chartNodes.values()));
  function calcWidth(node) {
    if (!node.children.length) { node._w = 1; return 1; }
    node._w = node.children.map(c => calcWidth(c)).reduce((a,b)=>a+b,0);
    return node._w;
  }
  hierarchy.children.forEach(calcWidth);
  function position(node, x, y) {
    const el = typeof document !== 'undefined' ? document.getElementById(`node-${safeId(node.id)}`) : null;
    if (el) { el.style.left = `${x}px`; el.style.top = `${y}px`; }
    let childX = x - (node._w * spacingX - spacingX) / 2;
    const childY = y + spacingY;
    node.children.forEach(c => {
      const width = c._w * spacingX;
      position(c, childX + width / 2, childY);
      childX += width;
    });
  }
  let startX = 30;
  const startY = 30;
  hierarchy.children.forEach(c => {
    position(c, startX + (c._w * spacingX) / 2, startY);
    startX += c._w * spacingX + spacingX;
  });
  redrawLines();
}
