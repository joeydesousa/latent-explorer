import React, { useState, useEffect, useRef } from 'react';
import Plot from 'react-plotly.js';
import { api } from './services/api';

// --- CONFIGURATION ---
const AXIS_RANGE = 5; // We will show from -10 to +10

function App() {
  const [points, setPoints] = useState([]);

  const [exactClick, setExactClick] = useState(null); 

  const [hoverImage, setHoverImage] = useState(null);  
  const [hoverCoords, setHoverCoords] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 }); // Screen pixels (for div position)
  const [isHovering, setIsHovering] = useState(false); // Toggle visibility

  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  useEffect(() => {
    const handleResize = () => { setWindowHeight(window.innerHeight);};
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
      background: '#f5f5f5'
      }}>
      
      {/* LEFT: Map */}
      <div style={{ padding: '20px' }}>
        
        {/* WRAPPER DIV: This captures the exact click */}
        <div 
            onClick={handleContainerClick}
            style={{ 
                width: PLOT_SIZE, 
                height: PLOT_SIZE, 
                border: '1px solid #ccc',
                background: 'white',
                cursor: 'crosshair !important',
                position: 'relative',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
        >
            <Plot
              data={[{
                x: points.map(p => p.x),
                y: points.map(p => p.y),
                type: 'scatter',
                mode: 'markers',
                marker: { color: '#2ecc71', opacity: 0.6, size: 6 },
                hoverinfo: 'none'
              }]}
              layout={{ 
                width: PLOT_SIZE, 
                height: PLOT_SIZE, 
                title: false,
                hovermode: 'closest',
                // IMPORTANT: Lock the axes and remove margins so math works
                xaxis: { range: [-AXIS_RANGE, AXIS_RANGE], fixedrange: true, visible: false },
                yaxis: { range: [-AXIS_RANGE, AXIS_RANGE], fixedrange: true, visible: false },
                margin: { l: 0, r: 0, t: 0, b: 0 }
              }}
              onHover={handleHover}
              config={{ displayModeBar: false }} // Hide the toolbar
            />
        </div>
      </div>

      {/* --- COLUMN 2: CONTROLS (SLIDERS) --- */}
      <div style={{
        flex: 1,
        padding: '20px',
        borderRight: '1px solid #e0e0e0',
        overflowY: 'auto'
      }}>
        <h2 style={{ color: '#3730a3'}}>Controls</h2>
        <p style={{color: '#666', fontSize: '0.9em'}}>Fine-tune your latent vector.</p>

        {/* Sliders Area */}
        <div style={{ marginTop: '30px' }}>

          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
            <div key={i} style={{ marginBottom: '20px' }}>
              <label style={{display: 'block', fontWeight: 'bold', marginBottom: '5px', color: '#3730a3'}}>Component {i}</label>
              <input type="range" min="-10" max="10" defaultValue="0" style={{width: '100%'}} />
            </div>
          ))}

        </div>
      </div>

      {/* --- COLUMN 3: OUTPUT (IMAGES) --- */}
      <div style={{
        flex: 1,
        background: 'white',
        borderLeft: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        gap: '0px'
      }}>
        
        {/* SECTION A: PREVIEW (Snaps to Nearest) */}
        <div style={{ padding: '15px', background: '#f9f9f9', borderRadius: '8px' }}>
            <h4 style={{marginTop: 0, color: '#3730a3'}}>🔍 Cache Preview</h4>
            {hoverCoords ? (
                <>
                    <div style={{ 
                    width: '50%', aspectRatio :'1/1',
                    background: hoverImage || '#ddd',
                    // backgroundImage: `url(${hoverImage})`,
                    backgroundSize: 'cover',
                    borderRadius: '4px',
                    marginBottom: '10px'
                    }} />
                    <code style={{fontSize: '0.8em', color: '#3730a3'}}>
                        {hoverCoords.x.toFixed(2)}, {hoverCoords.y.toFixed(2)}
                    </code>
                </>
            ) : <p style={{color: '#999'}}>Hover to preview...</p>}
        </div>

        {/* SECTION B: EXACT CLICK */}
        <div style={{ padding: '15px', background: '#eef2ff', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
            <h4 style={{marginTop: 0, color: '#3730a3'}}>📍 Exact Selection</h4>
            {exactClick ? (
                <>
                    <div style={{
                        width: '100%', aspectRatio: '1/1', 
                        background: '#ddd', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: '4px',
                        marginBottom: '10px'
                    }}>
                        {/* This would be your High Res GAN result */}
                        Rendering...
                    </div>
                    <code style={{fontSize: '0.8em', color: '#3730a3'}}>
                        Vector: [{exactClick.x.toFixed(2)}, {exactClick.y.toFixed(2)}, ...]
                    </code>
                    <button style={{
                        marginTop: '15px', 
                        width: '100%', 
                        padding: '10px', 
                        background: '#4f46e5', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px',
                        cursor: 'crosshair'
                    }}>
                        Download / Save
                    </button>
                </>
            ) : <p style={{color: '#666'}}>Click map to generate...</p>}
        </div>

      </div>

    </div>
  );
}

export default App;