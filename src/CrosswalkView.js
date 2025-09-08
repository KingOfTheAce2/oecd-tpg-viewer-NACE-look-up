function CrosswalkView() {
  const { useState, useEffect, useMemo } = React;

  // State management
  const [crosswalkData, setCrosswalkData] = useState([]);
  const [naicsFilter, setNaicsFilter] = useState('');
  const [naceFilter, setNaceFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [focusedColumn, setFocusedColumn] = useState(null);
  const [selectedRowIndex, setSelectedRowIndex] = useState(-1);

  // Load crosswalk data with fallback
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        let response;
        let data;
        
        try {
          // Try to load from public/data first
          response = await fetch('data/naics_nace_crosswalk.json');
          if (!response.ok) {
            throw new Error('Primary data source not found');
          }
          data = await response.json();
        } catch (primaryError) {
          // Fallback to crosswalks directory
          response = await fetch('../crosswalks/NAICS_2022_to_NACE_Rev21_crosswalk.json');
          if (!response.ok) {
            throw new Error('Fallback data source not found');
          }
          data = await response.json();
        }
        
        setCrosswalkData(data.crosswalk || []);
        setError(null);
      } catch (err) {
        console.error('Error loading crosswalk data:', err);
        setError('Failed to load crosswalk data. Please try again later.');
        setCrosswalkData([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Filter data based on search terms
  const filteredData = useMemo(() => {
    return crosswalkData.filter(item => {
      const naicsMatch = !naicsFilter || 
        item.naics2022Code.toLowerCase().includes(naicsFilter.toLowerCase()) ||
        item.naics2022Title.toLowerCase().includes(naicsFilter.toLowerCase());
      
      const naceMatch = !naceFilter || 
        item.naceRev21Code.toLowerCase().includes(naceFilter.toLowerCase()) ||
        item.naceRev21Title.toLowerCase().includes(naceFilter.toLowerCase());
      
      return naicsMatch && naceMatch;
    });
  }, [crosswalkData, naicsFilter, naceFilter]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!filteredData.length) return;
      
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedRowIndex(prev => 
            prev < filteredData.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedRowIndex(prev => prev > 0 ? prev - 1 : prev);
          break;
        case 'Tab':
          if (!e.shiftKey) {
            setFocusedColumn('naics');
          } else {
            setFocusedColumn('nace');
          }
          break;
        case 'Escape':
          setSelectedRowIndex(-1);
          setFocusedColumn(null);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredData.length]);

  // Copy to clipboard functionality
  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      // Simple feedback - could be enhanced with toast notifications
      console.log(`${type} copied to clipboard:`, text);
      
      // Visual feedback
      const button = event.target;
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      button.style.backgroundColor = '#28a745';
      
      setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = '';
      }, 1500);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  };

  if (loading) {
    return React.createElement('div', { 
      className: 'crosswalk-container loading-state' 
    }, 'Loading crosswalk data...');
  }

  if (error) {
    return React.createElement('div', { 
      className: 'crosswalk-container error-state' 
    }, error);
  }

  return React.createElement('div', { className: 'crosswalk-container' },
    // Header with disclaimer
    React.createElement('div', { className: 'crosswalk-header' },
      React.createElement('h2', null, 'NAICS & NACE Rev. 2.1 Side-by-Side'),
      React.createElement('div', { className: 'ai-disclaimer' },
        '⚠️ This crosswalk was 100% AI made and not yet verified by a human.'
      )
    ),

    // Search filters
    React.createElement('div', { className: 'search-filters' },
      React.createElement('div', { className: 'filter-group' },
        React.createElement('label', { htmlFor: 'naics-filter' }, 'Filter NAICS:'),
        React.createElement('input', {
          id: 'naics-filter',
          type: 'text',
          value: naicsFilter,
          onChange: (e) => setNaicsFilter(e.target.value),
          onFocus: () => setFocusedColumn('naics'),
          placeholder: 'Search NAICS codes or titles...',
          className: focusedColumn === 'naics' ? 'focused' : ''
        })
      ),
      React.createElement('div', { className: 'filter-group' },
        React.createElement('label', { htmlFor: 'nace-filter' }, 'Filter NACE Rev. 2.1:'),
        React.createElement('input', {
          id: 'nace-filter',
          type: 'text',
          value: naceFilter,
          onChange: (e) => setNaceFilter(e.target.value),
          onFocus: () => setFocusedColumn('nace'),
          placeholder: 'Search NACE codes or titles...',
          className: focusedColumn === 'nace' ? 'focused' : ''
        })
      )
    ),

    // Results count
    React.createElement('div', { className: 'results-info' },
      `Showing ${filteredData.length.toLocaleString()} of ${crosswalkData.length.toLocaleString()} mappings`
    ),

    // Side-by-side display
    React.createElement('div', { className: 'crosswalk-display' },
      React.createElement('div', { className: 'column naics-column' },
        React.createElement('h3', null, 'NAICS 2022'),
        React.createElement('div', { className: 'column-content' },
          filteredData.slice(0, 500).map((item, index) => 
            React.createElement('div', {
              key: `naics-${index}`,
              className: `crosswalk-row ${selectedRowIndex === index ? 'selected' : ''}`,
              onClick: () => setSelectedRowIndex(index)
            },
              React.createElement('div', { className: 'row-header' },
                React.createElement('strong', null, item.naics2022Code),
                React.createElement('button', {
                  className: 'copy-btn',
                  onClick: (e) => {
                    e.stopPropagation();
                    copyToClipboard(`${item.naics2022Code}: ${item.naics2022Title}`, 'NAICS');
                  },
                  title: 'Copy NAICS code and title'
                }, '📋')
              ),
              React.createElement('div', { className: 'row-content' },
                item.naics2022Title
              ),
              item.mappingPath.includes('no NACE mapping') && 
                React.createElement('div', { className: 'mapping-warning' }, 
                  '⚠️ No NACE mapping available'
                )
            )
          )
        )
      ),
      
      React.createElement('div', { className: 'column nace-column' },
        React.createElement('h3', null, 'NACE Rev. 2.1'),
        React.createElement('div', { className: 'column-content' },
          filteredData.slice(0, 500).map((item, index) => 
            React.createElement('div', {
              key: `nace-${index}`,
              className: `crosswalk-row ${selectedRowIndex === index ? 'selected' : ''} ${
                !item.naceRev21Code ? 'no-mapping' : ''
              }`,
              onClick: () => setSelectedRowIndex(index)
            },
              React.createElement('div', { className: 'row-header' },
                React.createElement('strong', null, item.naceRev21Code || 'N/A'),
                item.naceRev21Code && React.createElement('button', {
                  className: 'copy-btn',
                  onClick: (e) => {
                    e.stopPropagation();
                    copyToClipboard(`${item.naceRev21Code}: ${item.naceRev21Title}`, 'NACE');
                  },
                  title: 'Copy NACE code and title'
                }, '📋')
              ),
              React.createElement('div', { className: 'row-content' },
                item.naceRev21Title || 'No NACE mapping available'
              ),
              item.partialMappings && (item.partialMappings.naicsPartial || 
                item.partialMappings.isicPartial || item.partialMappings.nacePartial) &&
                React.createElement('div', { className: 'mapping-info' }, 
                  '📋 Partial mapping'
                )
            )
          )
        )
      )
    ),

    // Performance notice for large datasets
    filteredData.length > 500 && 
      React.createElement('div', { className: 'performance-notice' },
        `Displaying first 500 results. Use filters to narrow your search for better performance.`
      ),

    // Keyboard navigation help
    React.createElement('div', { className: 'keyboard-help' },
      React.createElement('small', null,
        'Keyboard shortcuts: ↑↓ arrows to navigate, Tab to switch columns, Esc to clear selection'
      )
    )
  );
}

// CSS styles
const crosswalkStyles = `
.crosswalk-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.crosswalk-header {
  text-align: center;
  margin-bottom: 30px;
}

.crosswalk-header h2 {
  margin: 0 0 15px 0;
  color: #2c3e50;
}

.ai-disclaimer {
  background-color: #fff3cd;
  border: 1px solid #ffeeba;
  color: #856404;
  padding: 12px 20px;
  border-radius: 6px;
  font-weight: 500;
  display: inline-block;
}

.search-filters {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.filter-group {
  flex: 1;
  min-width: 300px;
}

.filter-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 600;
  color: #495057;
}

.filter-group input {
  width: 100%;
  padding: 10px 12px;
  border: 2px solid #e9ecef;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
}

.filter-group input:focus,
.filter-group input.focused {
  outline: none;
  border-color: #007bff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

.results-info {
  text-align: center;
  margin-bottom: 20px;
  font-size: 14px;
  color: #6c757d;
}

.crosswalk-display {
  display: flex;
  gap: 20px;
  min-height: 600px;
}

.column {
  flex: 1;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  overflow: hidden;
}

.column h3 {
  background-color: #f8f9fa;
  margin: 0;
  padding: 15px 20px;
  border-bottom: 1px solid #dee2e6;
  color: #495057;
  font-size: 16px;
}

.column-content {
  height: 600px;
  overflow-y: auto;
  padding: 10px;
}

.crosswalk-row {
  border: 1px solid #e9ecef;
  border-radius: 6px;
  margin-bottom: 8px;
  padding: 12px;
  background-color: #fff;
  cursor: pointer;
  transition: all 0.15s ease;
}

.crosswalk-row:hover {
  background-color: #f8f9fa;
  border-color: #007bff;
}

.crosswalk-row.selected {
  background-color: #e7f3ff;
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
}

.crosswalk-row.no-mapping {
  background-color: #f8d7da;
  border-color: #f5c6cb;
}

.row-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.row-header strong {
  color: #2c3e50;
  font-size: 14px;
}

.copy-btn {
  background: none;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 4px 6px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s ease;
}

.copy-btn:hover {
  background-color: #007bff;
  border-color: #007bff;
  color: white;
}

.row-content {
  font-size: 13px;
  line-height: 1.4;
  color: #495057;
}

.mapping-warning {
  margin-top: 6px;
  font-size: 11px;
  color: #856404;
  background-color: #fff3cd;
  padding: 4px 6px;
  border-radius: 3px;
}

.mapping-info {
  margin-top: 6px;
  font-size: 11px;
  color: #0c5460;
  background-color: #d1ecf1;
  padding: 4px 6px;
  border-radius: 3px;
}

.performance-notice {
  text-align: center;
  margin-top: 20px;
  padding: 10px;
  background-color: #e2e8f0;
  border-radius: 6px;
  color: #4a5568;
  font-size: 14px;
}

.keyboard-help {
  text-align: center;
  margin-top: 15px;
  color: #6c757d;
}

.loading-state, .error-state {
  text-align: center;
  padding: 40px 20px;
  color: #6c757d;
  font-size: 16px;
}

.error-state {
  color: #dc3545;
  background-color: #f8d7da;
  border: 1px solid #f5c6cb;
  border-radius: 6px;
}

@media (max-width: 768px) {
  .crosswalk-display {
    flex-direction: column;
  }
  
  .search-filters {
    flex-direction: column;
  }
  
  .filter-group {
    min-width: auto;
  }
  
  .column-content {
    height: 400px;
  }
}
`;

// Inject styles
if (!document.getElementById('crosswalk-styles')) {
  const styleElement = document.createElement('style');
  styleElement.id = 'crosswalk-styles';
  styleElement.textContent = crosswalkStyles;
  document.head.appendChild(styleElement);
}

// Export for use
window.CrosswalkView = CrosswalkView;