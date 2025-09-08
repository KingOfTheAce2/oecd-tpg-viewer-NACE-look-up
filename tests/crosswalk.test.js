import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

// Mock fetch for testing
global.fetch = jest.fn();

describe('NACE and NAICS Side by Side View', () => {
  let dom;
  let document;
  let window;
  let sampleData;

  beforeAll(() => {
    // Load sample test data
    const samplePath = path.join(process.cwd(), 'tests', 'fixtures', 'crosswalk_sample.json');
    sampleData = JSON.parse(fs.readFileSync(samplePath, 'utf8'));
  });

  beforeEach(() => {
    // Create a fresh DOM for each test using the new React-based HTML
    const htmlPath = path.join(process.cwd(), 'docs', 'crosswalks.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    dom = new JSDOM(htmlContent, {
      url: 'http://localhost/',
      resources: 'usable',
      runScripts: 'dangerously'
    });
    
    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;
    global.React = window.React;
    global.ReactDOM = window.ReactDOM;
    
    // Mock fetch to return our sample data
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(sampleData)
    });
  });

  afterEach(() => {
    fetch.mockClear();
  });

  test('page renders with correct title', () => {
    expect(document.title).toBe('NACE and NAICS Side by Side');
  });

  test('displays AI disclaimer (now in React component)', () => {
    // The disclaimer is now rendered by the React component, not in static HTML
    // This test verifies the HTML structure is clean without the old disclaimer
    const oldDisclaimer = document.querySelector('div[style*="background-color: #fff3cd"]');
    expect(oldDisclaimer).toBeFalsy(); // Should not exist in HTML anymore
    
    // The actual disclaimer is rendered by React component which we'll test in component tests
    const reactContainer = document.querySelector('#crosswalk-root');
    expect(reactContainer).toBeTruthy();
  });

  test('has back navigation link', () => {
    const backLink = document.querySelector('a[href="index.html"]');
    expect(backLink).toBeTruthy();
    expect(backLink.textContent).toContain('Back to Main Menu');
  });

  test('includes React and React DOM scripts', () => {
    const reactScript = document.querySelector('script[src*="react.development.js"]');
    const reactDomScript = document.querySelector('script[src*="react-dom.development.js"]');
    
    expect(reactScript).toBeTruthy();
    expect(reactDomScript).toBeTruthy();
  });

  test('loads CrosswalkView component script', () => {
    const crosswalkScript = document.querySelector('script[src="CrosswalkView.js"]');
    expect(crosswalkScript).toBeTruthy();
  });

  test('has container for CrosswalkView component', () => {
    const container = document.querySelector('#crosswalk-root');
    expect(container).toBeTruthy();
  });

  test('no download buttons exist in HTML', () => {
    const downloadLinks = document.querySelectorAll('a[href*="download"], a[href*="csv"], a[href*="json"], button[onclick*="download"]');
    expect(downloadLinks).toHaveLength(0);
  });

  test('no View documentation button exists', () => {
    const docButtons = document.querySelectorAll('a[href*="doc"], button[onclick*="doc"], *[textContent*="View Documentation"]');
    expect(docButtons).toHaveLength(0);
  });

  test('no statistics section exists', () => {
    const statsElements = document.querySelectorAll('*[id*="stats"], h3, h4, h5');
    const statsFound = Array.from(statsElements).some(el => 
      el.textContent.includes('Statistics') || 
      el.textContent.includes('Crosswalk Statistics') ||
      el.textContent.includes('Loading statistics')
    );
    expect(statsFound).toBe(false);
  });

  test('no loading statistics text exists', () => {
    const loadingText = document.body.textContent;
    expect(loadingText).not.toMatch(/Loading.*statistics/i);
  });

  // Test component structure that would be rendered by React
  test('has React app structure for side-by-side crosswalk view', () => {
    const appScript = document.querySelector('script');
    const scriptContent = Array.from(document.querySelectorAll('script')).find(script => 
      script.textContent.includes('CrosswalkView')
    );
    
    expect(scriptContent).toBeTruthy();
    expect(scriptContent.textContent).toContain('createElement(CrosswalkView');
    expect(scriptContent.textContent).toContain('ReactDOM.createRoot');
  });

  // Test for sample data structure compatibility
  test('sample fixture has required structure for CrosswalkView', () => {
    expect(sampleData).toHaveProperty('crosswalk');
    expect(Array.isArray(sampleData.crosswalk)).toBe(true);
    
    if (sampleData.crosswalk.length > 0) {
      const firstItem = sampleData.crosswalk[0];
      expect(firstItem).toHaveProperty('naics2022Code');
      expect(firstItem).toHaveProperty('naics2022Title');
      expect(firstItem).toHaveProperty('naceRev21Code');
      expect(firstItem).toHaveProperty('naceRev21Title');
    }
  });

  test('page structure supports side-by-side display', () => {
    // The React component will create the side-by-side structure
    // Test that the container exists for React to render into
    const rootContainer = document.querySelector('#crosswalk-root');
    expect(rootContainer).toBeTruthy();
    
    // Test that old table structure is removed
    const oldTable = document.querySelector('.crosswalk-table');
    expect(oldTable).toBeNull();
  });

  test('old search input removed from HTML', () => {
    // Old single search input should be gone
    const oldSearchInput = document.querySelector('#searchInput');
    expect(oldSearchInput).toBeNull();
    
    // Old search container should be gone
    const oldSearchContainer = document.querySelector('.search-container');
    expect(oldSearchContainer).toBeNull();
  });

  test('clean HTML structure without old elements', () => {
    // Verify old elements are removed
    expect(document.querySelector('#loading')).toBeNull();
    expect(document.querySelector('#results')).toBeNull();
    expect(document.querySelector('#stats')).toBeNull();
    expect(document.querySelector('#noResults')).toBeNull();
    expect(document.querySelector('#tableBody')).toBeNull();
  });
});