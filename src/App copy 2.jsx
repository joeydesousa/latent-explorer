import React, { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { api } from './services/api';

// --- CONFIGURATION ---
const AXIS_RANGE = 5; // We will show from -10 to +10

function App() {
  const [points, setPoints] = useState([]);
  const [hoverImage, setHoverImage] = useState(null);
  
  const [exactClick, setExactClick] = useState(null); 
  const [hoverCoords, setHoverCoords] = useState(null);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const PLOT_SIZE = windowHeight - 40;

  useEffect(() => {
    api.getMapData().then(data => setPoints(data));
  }, []);

  // 1. HOVER (Native Plotly)
  // This still snaps to the nearest point for the Preview, which is good!
  const handleHover = async (event) => {
    const point = event.points[0];
    setHoverCoords({ x: point.x, y: point.y });
    
    // Get cached preview
    const imgData = await api.generateImage(point.x, point.y);
    setHoverImage(imgData);
  };

  // 2. CLICK (Native React DOM Event)
  // This captures the click anywhere on the div, even in white space
  const handleContainerClick = async (e) => {
    // A. Get the click position relative to the div (0 to 600 pixels)
    // We use getBoundingClientRect to be safe against page scrolling
    const rect = e.currentTarget.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;

    // B. Convert Pixels to Graph Coordinates
    // Math: Ratio * TotalRange + MinValue
    // Note: Y pixel 0 is at the top, but Graph Y +10 is at the top. We invert Y.
    
    const x = (pixelX / PLOT_SIZE) * (AXIS_RANGE * 2) - AXIS_RANGE;
    const y = -((pixelY / PLOT_SIZE) * (AXIS_RANGE * 2) - AXIS_RANGE); // Inverted Y

    // C. Update State with EXACT coords
    setExactClick({ x, y });
    
    // In the future: Call your real GAN API with these exact floats
    // const hdImage = await api.generateHighRes(x, y);
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100vw',
      fontFamily: 'sans-serif',
      overflow: 'hidden',
      }}>
      
      {/* LEFT: Map */}
      <div style={{ width: PLOT_SIZE, height: PLOT_SIZE, margin: '20px' }}>
        
        {/* WRAPPER DIV: This captures the exact click */}
        <div 
            onClick={handleContainerClick}
            style={{ 
                width: PLOT_SIZE, 
                height: PLOT_SIZE, 
                border: '1px solid #ccc',
                cursor: 'crosshair',
                position: 'relative'
            }}
        >
            <Plot
              data={[{
                x: points.map(p => p.x),
                y: points.map(p => p.y),
                type: 'scatter',
                mode: 'markers',
                marker: { color: 'green', opacity: 0.5, size: 5 },
                hoverinfo: 'none' // We handle hover manually via onHover
              }]}
              layout={{ 
                width: PLOT_SIZE, 
                height: PLOT_SIZE, 
                title: false,
                hovermode: 'closest',
                // IMPORTANT: Lock the axes and remove margins so math works
                xaxis: { range: [-AXIS_RANGE, AXIS_RANGE], fixedrange: true },
                yaxis: { range: [-AXIS_RANGE, AXIS_RANGE], fixedrange: true },
                margin: { l: 0, r: 0, t: 0, b: 0 }
              }}
              onHover={handleHover}
              config={{ displayModeBar: false }} // Hide the toolbar
            />
        </div>
      </div>

      {/* RIGHT: Sidebar */}
      <div style={{ flex: 1, background: '#d42a2aff', padding: 20, overflowY: 'auto' }}>
        
        {/* SECTION A: PREVIEW (Snaps to Nearest) */}
        <div style={{ marginBottom: 30 }}>
            <h3>🔍 Cache Preview</h3>
            {hoverCoords ? (
                <>
                    <p style={{color: '#666'}}>Snapped: {hoverCoords.x.toFixed(2)}, {hoverCoords.y.toFixed(2)}</p>
                    <div style={{ 
                    width: '100%',
                    maxWidth: '300px', 
                    aspectRatio :'1/1',
                    background: hoverImage || '#ddd',
                    backgroundSize: 'cover',
                    borderRadius: '8px'
                    }} />
                </>
            ) : <p>Hover to preview...</p>}
        </div>

        {/* SECTION B: EXACT CLICK */}
        <div style={{ borderTop: '2px solid #ccc', paddingTop: 20 }}>
            <h3>📍 Exact Selection</h3>
            {exactClick ? (
                <>
                    <p style={{color: 'blue', fontWeight: 'bold'}}>
                        Latent Vector: {exactClick.x.toFixed(4)}, {exactClick.y.toFixed(4)}
                    </p>
                    <div style={{
                        width: '100%',
                        maxWidth: '300px',
                        aspectRatio: '1/1', 
                        background: '#ddd', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '8px',
                        border: '2px solid blue'
                    }}>
                        {/* This would be your High Res GAN result */}
                        Generating at {exactClick.x.toFixed(2)}, {exactClick.y.toFixed(2)}...
                    </div>

                    <div style={{ marginTop: 20 }}>
                        <label>Spikiness</label>
                        <input type="range" style={{width: '100%'}} />
                    </div>

                    <div style={{ marginTop: 20 }}>
                        <label>Colour</label>
                        <input type="range" style={{width: '100%'}} />
                    </div>
                </>
            ) : (
                <p>Click anywhere in the whitespace!</p>
            )}
        </div>

      </div>
    </div>
  );
}

export default App;