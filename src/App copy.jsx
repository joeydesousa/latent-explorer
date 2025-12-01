import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { api } from './services/api';

function App() {
  const [points, setPoints] = useState([]);
  const [hoverImage, setHoverImage] = useState(null);

  // Hover (snap to points) vs Click (exact)
  const [hoverCoords, setHoverCoords] = useState({ x: 0, y: 0 });
  const [clickedPoint, setClickedPoint] = useState(null); // Stores {x, y, image}
  
  // 1. Load the Map on Startup
  useEffect(() => {
    api.getMapData().then(data => setPoints(data));
  }, []);

  // 2. Handle Hover (Fast Preview)
  const handleHover = async (event) => {
    const point = event.points[0];
    setHoverCoords({ x: point.x, y: point.y });
    
    // Call our API (which is currently Mocked)
    const imgData = await api.generateImage(point.x, point.y);
    setHoverImage(imgData);
  };

  // 2. CLICK HANDLER (Exact Selection)
  const handleClick = async (event) => {
    const point = event.points[0];
    // Note: Plotly might snap to the nearest point. 
    // To get true mouse coords even in empty space, we'd need a different event,
    // but for now, clicking the 'grid' dots works perfectly.
    
    const x = point.x;
    const y = point.y;

    // In real app: This would call the SLOW, HIGH-RES generation
    const imgData = await api.generateImage(x, y); 
    
    setClickedPoint({ x, y, image: imgData });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* LEFT: The Map */}
      <div style={{ flex: 1, padding: 20 }}>
        <h2>Latent Explorer (Mock Mode)</h2>
        <Plot
          data={[
            {
              x: points.map(p => p.x),
              y: points.map(p => p.y),
              type: 'scatter',
              mode: 'markers',
              marker: { color: 'green', opacity: 0.5 },
            },
          ]}
          layout={{ 
            width: 600, 
            height: 600, 
            title: 'Seaweed Space',
            hovermode: 'closest'
          }}
          onHover={handleHover}
          onClick={handleClick}
        />
      </div>

      {/* RIGHT: Sidebar */}
      <div style={{ width: '400px', background: '#b92828ff', padding: 20 }}>
        
        {/* SECTION A: PREVIEW (Hover) */}
        <div style={{ marginBottom: '30px', borderBottom: '2px solid #ccc', paddingBottom: '20px'}}>
            <h3>🔍 Preview (Hover)</h3>
            <p style={{fontSize: '0.9em', color: '#666'}}>
                Near: {hoverCoords.x.toFixed(2)}, {hoverCoords.y.toFixed(2)}
            </p>
            <div style={{ 
                width: '150px', height: '150px', 
                background: hoverImage || '#ddd',
                backgroundSize: 'cover' 
            }} />
        </div>

        {/* SECTION B: SELECTION (Click) */}
        <div>
            <h3>📍 Selection (Exact)</h3>
            {clickedPoint ? (
                <>
                    <p style={{fontWeight: 'bold', color: 'blue'}}>
                        Exact Coords: {clickedPoint.x.toFixed(4)}, {clickedPoint.y.toFixed(4)}
                    </p>
                    <div style={{ 
                        width: '300px', height: '300px', 
                        background: clickedPoint.image || '#ddd',
                        backgroundSize: 'cover',
                        border: '2px solid blue'
                    }} />
                    
                    <div style={{ marginTop: 20 }}>
                        <h4>Edit this Selection</h4>
                        <label>Spikiness</label>
                        <input type="range" style={{width: '100%'}} />
                    </div>
                </>
            ) : (
                <p>Click a point on the map to select it.</p>
            )}
        </div>

      </div>
    </div>
  );
}

export default App;