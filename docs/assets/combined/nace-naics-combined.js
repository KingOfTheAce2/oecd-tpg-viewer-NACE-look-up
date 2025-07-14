function NACE_NAICS_Combined() {
  const { useState, useEffect } = React;
  const [query, setQuery] = useState('');
  const [naceData, setNaceData] = useState([]);
  const [naicsData, setNaicsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch('assets/nace/nace_data.json').then(r => r.json()),
      fetch('assets/naics/naics_data.json').then(r => r.json())
    ]).then(([nace, naics]) => {
      setNaceData(nace);
      setNaicsData(naics);
      setLoading(false);
    }).catch(err => {
      setError('Error: ' + err.message);
      setLoading(false);
    });
  }, []);

  const formatText = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    let listItems = [];
    const parts = [];
    const flush = () => {
      if (listItems.length > 0) {
        parts.push(
          React.createElement('ul', {style:{marginLeft:'20px',marginBottom:'4px'}},
            listItems.map((li,idx)=>React.createElement('li',{key:idx},li))
          )
        );
        listItems = [];
      }
    };
    lines.forEach((line,idx)=>{
      const t = line.trim();
      if (!t) return;
      if (t.startsWith('•') || t.startsWith('-')) {
        listItems.push(t.replace(/^[•-]\s*/, ''));
      } else {
        flush();
        parts.push(React.createElement('div',{key:`p-${idx}`,style:{marginBottom:'4px'}},t));
      }
    });
    flush();
    return React.createElement('div', null, ...parts);
  };

  const filterItems = (items) => {
    if (!query) return [];
    const q = query.toLowerCase();
    return items.filter(it =>
      Object.values(it).some(v => v && v.toString().toLowerCase().includes(q))
    );
  };

  const filteredNace = filterItems(naceData);
  const filteredNaics = filterItems(naicsData);

  if (loading) return React.createElement('div',{style:{padding:'20px',textAlign:'center'}},'Loading data...');
  if (error) return React.createElement('div',{style:{padding:'20px',textAlign:'center'}},error);

  return (
    React.createElement('div', null,
      React.createElement('div',{style:{textAlign:'center',marginBottom:'16px'}},
        React.createElement('input', {
          type:'text',
          placeholder:'Search NACE and NAICS...',
          value: query,
          onChange: e => setQuery(e.target.value),
          style:{width:'100%',maxWidth:'600px',padding:'10px'}
        })
      ),
      React.createElement('div',{className:'container'},
        React.createElement('div',{className:'viewer'},
          React.createElement('h2', null, 'NACE Results'),
          filteredNace.length>0 ? filteredNace.map((item,idx)=>
            React.createElement('div',{key:idx,style:{marginBottom:'16px',padding:'16px',backgroundColor:'#fff',border:'1px solid #ddd',borderRadius:'4px',boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}},
              React.createElement('div',{style:{marginBottom:'12px'}},
                React.createElement('strong',null,'Code: '),
                React.createElement('span',{style:{fontWeight:'bold',color:'#007bff'}}, item.CODE.toString())
              ),
              React.createElement('div',{style:{marginBottom:'12px'}},
                React.createElement('strong',null,'Name: '),
                React.createElement('span',null,item.NAME)
              ),
              item.Includes ? React.createElement('div',{style:{marginBottom:'12px'}},
                React.createElement('strong',{style:{display:'block',marginBottom:'4px'}},'Includes:'),
                formatText(item.Includes)
              ) : null,
              item.IncludesAlso ? React.createElement('div',{style:{marginBottom:'12px'}},
                React.createElement('strong',{style:{display:'block',marginBottom:'4px'}},'Includes Also:'),
                formatText(item.IncludesAlso)
              ) : null,
              item.Excludes ? React.createElement('div',{style:{marginBottom:'12px'}},
                React.createElement('strong',{style:{display:'block',marginBottom:'4px'}},'Excludes:'),
                formatText(item.Excludes)
              ) : null
            )
          ) : React.createElement('p',{style:{textAlign:'center'}},'No results.')
        ),
        React.createElement('div',{className:'viewer'},
          React.createElement('h2', null, 'NAICS Results'),
          filteredNaics.length>0 ? filteredNaics.map((item,idx)=>
            React.createElement('div',{key:idx,style:{marginBottom:'16px',padding:'16px',backgroundColor:'#fff',border:'1px solid #ddd',borderRadius:'4px',boxShadow:'0 2px 4px rgba(0,0,0,0.1)'}},
              React.createElement('div',{style:{marginBottom:'12px'}},
                React.createElement('strong',null,'Code: '),
                React.createElement('span',{style:{fontWeight:'bold',color:'#007bff'}}, item.Code.toString())
              ),
              React.createElement('div',{style:{marginBottom:'12px'}},
                React.createElement('strong',null,'Name: '),
                React.createElement('span',null,item.Name)
              ),
              item.Description ? React.createElement('div',{style:{marginBottom:'12px'}},
                React.createElement('strong',{style:{display:'block',marginBottom:'4px'}},'Description:'),
                formatText(item.Description)
              ) : null,
              item["Cross-Reference"] ? React.createElement('div',{style:{marginBottom:'12px'}},
                React.createElement('strong',{style:{display:'block',marginBottom:'4px'}},'Cross-Reference:'),
                formatText(item["Cross-Reference"])
              ) : null
            )
          ) : React.createElement('p',{style:{textAlign:'center'}},'No results.')
        )
      )
    )
  );
}

window.renderNaceNaicsCombined = function(rootId) {
  ReactDOM.createRoot(document.getElementById(rootId)).render(
    React.createElement(NACE_NAICS_Combined)
  );
};

if (document.currentScript && document.getElementById('root')) {
  window.renderNaceNaicsCombined('root');
}
