function NACE_NAICS_Combined() {
  const { useState, useEffect } = React;

  // primary and secondary query + field
  const [primaryQuery, setPrimaryQuery] = useState('');
  const [primaryField, setPrimaryField] = useState('all');
  const [secondaryQuery, setSecondaryQuery] = useState('');
  const [secondaryField, setSecondaryField] = useState('all');

  // data and filtered results
  const [naceData, setNaceData] = useState([]);
  const [naicsData, setNaicsData] = useState([]);
  const [filteredNace, setFilteredNace] = useState([]);
  const [filteredNaics, setFilteredNaics] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // load both datasets once
  useEffect(() => {
    Promise.all([
      fetch('assets/nace/nace_data.json').then(r => r.json()),
      fetch('assets/naics/naics_data.json').then(r => r.json())
    ])
    .then(([nace, naics]) => {
      setNaceData(nace);
      setNaicsData(naics);
      setLoading(false);
    })
    .catch(err => {
      setError('Error: ' + err.message);
      setLoading(false);
    });
  }, []);

  // same formatting helper as before
  const formatText = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    let listItems = [];
    const parts = [];
    const flush = () => {
      if (listItems.length) {
        parts.push(
          React.createElement('ul',
            { style:{ marginLeft:'20px', marginBottom:'4px' } },
            listItems.map((li,idx) =>
              React.createElement('li', { key:idx }, li)
            )
          )
        );
        listItems = [];
      }
    };
    lines.forEach((line,idx) => {
      const t = line.trim();
      if (!t) return;
      if (t.startsWith('•') || t.startsWith('-')) {
        listItems.push(t.replace(/^[•-]\s*/, ''));
      } else {
        flush();
        parts.push(
          React.createElement('div',
            { key:`p-${idx}`, style:{ marginBottom:'4px' } },
            t
          )
        );
      }
    });
    flush();
    return React.createElement('div', null, ...parts);
  };

  // on Search click: filter both sets by primary AND secondary
  const handleSearch = () => {
    const q1 = primaryQuery.toLowerCase();
    const q2 = secondaryQuery.toLowerCase();

    const filterItems = (items, codeKey, nameKey) =>
      items.filter(item => {
        const getVal = field => {
          if (field === 'all') return true;
          const v = item[field] || item[field.toLowerCase()] || '';
          return v.toString().toLowerCase().includes(field === primaryField ? q1 : q2);
        };
        // primary match AND secondary match
        return getVal(primaryField) && getVal(secondaryField);
      });

    setFilteredNace(filterItems(naceData, 'CODE', 'NAME'));
    setFilteredNaics(filterItems(naicsData, 'Code', 'Name'));
  };

  const handleReset = () => {
    setPrimaryQuery('');      setPrimaryField('all');
    setSecondaryQuery('');    setSecondaryField('all');
    setFilteredNace([]);      setFilteredNaics([]);
  };

  if (loading) return React.createElement('div',
    { style:{ padding:'20px', textAlign:'center' } },
    'Loading data...'
  );
  if (error) return React.createElement('div',
    { style:{ padding:'20px', textAlign:'center' } },
    error
  );

  // render
  return React.createElement('div', { style:{ padding:'20px', maxWidth:'1000px', margin:'0 auto' } },
    // Primary search controls
    React.createElement('div', { style:{ marginBottom:'16px' } },
      React.createElement('h3', null, 'Primary Search'),
      React.createElement('input', {
        type:'text',
        placeholder:'Primary query...',
        value: primaryQuery,
        onChange: e => setPrimaryQuery(e.target.value),
        onKeyDown: e => { if (e.key === 'Enter') handleSearch() },
        style:{ width:'100%', padding:'10px', marginBottom:'8px' }
      }),
      React.createElement('select', {
        value: primaryField,
        onChange: e => setPrimaryField(e.target.value),
        style:{ width:'100%', padding:'10px' }
      },
        React.createElement('option',{value:'all'},'All Fields'),
        React.createElement('option',{value:'CODE'}, 'Code'),
        React.createElement('option',{value:'NAME'}, 'Name'),
        React.createElement('option',{value:'Includes'}, 'Includes'),
        React.createElement('option',{value:'IncludesAlso'}, 'Includes Also'),
        React.createElement('option',{value:'Excludes'}, 'Excludes')
      )
    ),

    // Secondary search controls
    React.createElement('div', { style:{ marginBottom:'16px' } },
      React.createElement('h3', null, 'Secondary Search (optional)'),
      React.createElement('input', {
        type:'text',
        placeholder:'Secondary query...',
        value: secondaryQuery,
        onChange: e => setSecondaryQuery(e.target.value),
        onKeyDown: e => { if (e.key === 'Enter') handleSearch() },
        style:{ width:'100%', padding:'10px', marginBottom:'8px' }
      }),
      React.createElement('select', {
        value: secondaryField,
        onChange: e => setSecondaryField(e.target.value),
        style:{ width:'100%', padding:'10px' }
      },
        React.createElement('option',{value:'all'},'All Fields'),
        React.createElement('option',{value:'CODE'}, 'Code'),
        React.createElement('option',{value:'NAME'}, 'Name'),
        React.createElement('option',{value:'Includes'}, 'Includes'),
        React.createElement('option',{value:'IncludesAlso'}, 'Includes Also'),
        React.createElement('option',{value:'Excludes'}, 'Excludes')
      )
    ),

    // Buttons
    React.createElement('div', { style:{ textAlign:'center', marginBottom:'20px' } },
      React.createElement('button', {
        onClick: handleSearch,
        style:{ padding:'10px 20px', marginRight:'10px', cursor:'pointer', border:'none', borderRadius:'4px', backgroundColor:'#007bff', color:'#fff' }
      }, 'Search'),
      React.createElement('button', {
        onClick: handleReset,
        style:{ padding:'10px 20px', cursor:'pointer', border:'none', borderRadius:'4px', backgroundColor:'#6c757d', color:'#fff' }
      }, 'Reset')
    ),

    // Results side by side
    React.createElement('div', { className:'container' },
      React.createElement('div', { className:'viewer' },
        React.createElement('h2', null, 'NACE Results'),
        filteredNace.length
          ? filteredNace.map((item, idx) =>
              React.createElement('div', {
                  key:idx,
                  style:{ marginBottom:'16px', padding:'16px', backgroundColor:'#fff',
                          border:'1px solid #ddd', borderRadius:'4px',
                          boxShadow:'0 2px 4px rgba(0,0,0,0.1)' }
                },
                React.createElement('div', { style:{ marginBottom:'12px' } },
                  React.createElement('strong', null, 'Code: '),
                  React.createElement('span',
                    { style:{ fontWeight:'bold', color:'#007bff' } },
                    item.CODE
                  )
                ),
                React.createElement('div', { style:{ marginBottom:'12px' } },
                  React.createElement('strong', null, 'Name: '),
                  React.createElement('span', null, item.NAME)
                ),
                item.Includes && React.createElement('div', { style:{ marginBottom:'12px' } },
                  React.createElement('strong', { style:{ display:'block', marginBottom:'4px' } }, 'Includes:'),
                  formatText(item.Includes)
                ),
                item.IncludesAlso && React.createElement('div', { style:{ marginBottom:'12px' } },
                  React.createElement('strong', { style:{ display:'block', marginBottom:'4px' } }, 'Includes Also:'),
                  formatText(item.IncludesAlso)
                ),
                item.Excludes && React.createElement('div', { style:{ marginBottom:'12px' } },
                  React.createElement('strong', { style:{ display:'block', marginBottom:'4px' } }, 'Excludes:'),
                  formatText(item.Excludes)
                )
              )
            )
          : React.createElement('p', { style:{ textAlign:'center' } }, 'No results.')
      ),

      React.createElement('div', { className:'viewer' },
        React.createElement('h2', null, 'NAICS Results'),
        filteredNaics.length
          ? filteredNaics.map((item, idx) =>
              React.createElement('div', {
                  key:idx,
                  style:{ marginBottom:'16px', padding:'16px', backgroundColor:'#fff',
                          border:'1px solid #ddd', borderRadius:'4px',
                          boxShadow:'0 2px 4px rgba(0,0,0,0.1)' }
                },
                React.createElement('div', { style:{ marginBottom:'12px' } },
                  React.createElement('strong', null, 'Code: '),
                  React.createElement('span',
                    { style:{ fontWeight:'bold', color:'#007bff' } },
                    item.Code
                  )
                ),
                React.createElement('div', { style:{ marginBottom:'12px' } },
                  React.createElement('strong', null, 'Name: '),
                  React.createElement('span', null, item.Name)
                ),
                item.Description && React.createElement('div', { style:{ marginBottom:'12px' } },
                  React.createElement('strong', { style:{ display:'block', marginBottom:'4px' } }, 'Description:'),
                  formatText(item.Description)
                ),
                item['Cross-Reference'] && React.createElement('div', { style:{ marginBottom:'12px' } },
                  React.createElement('strong', { style:{ display:'block', marginBottom:'4px' } }, 'Cross-Reference:'),
                  formatText(item['Cross-Reference'])
                )
              )
            )
          : React.createElement('p', { style:{ textAlign:'center' } }, 'No results.')
      )
    )
  );
}

window.renderNaceNaicsCombined = function(rootId) {
  ReactDOM.createRoot(document.getElementById(rootId))
    .render(React.createElement(NACE_NAICS_Combined));
};

// auto-init if you embed directly
if (document.currentScript && document.getElementById('root')) {
  window.renderNaceNaicsCombined('root');
}
