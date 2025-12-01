import React, { useState, useEffect } from 'react';
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

  // --- MOUSE HANDLER (Combined Move + Hover) ---
  // We attach this to the WRAPPER DIV so it tracks mouse everywhere
  const handleMouseMove = async (e) => {
  // --- 1. SMART POSITIONING LOGIC ---
    const OFFSET = 20; // Distance from cursor
    const BOX_W = 140; // Approximate width of the floating box
    const BOX_H = 160; // Approximate height (Image + Text + Padding)

    let finalX = e.clientX + OFFSET;
    let finalY = e.clientY + OFFSET;

    // Check Right Edge: If box goes off right side, flip to left of cursor
    if (finalX + BOX_W > window.innerWidth) {
        finalX = e.clientX - OFFSET - BOX_W;
    }

    // Check Bottom Edge: If box goes off bottom, flip to top of cursor
    if (finalY + BOX_H > window.innerHeight) {
        finalY = e.clientY - OFFSET - BOX_H;
    }

    setMousePos({ x: finalX, y: finalY });

    // 2. Calculate Graph Coordinates (Math)
    const rect = e.currentTarget.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;

    const x = (pixelX / PLOT_SIZE) * (AXIS_RANGE * 2) - AXIS_RANGE;
    const y = -((pixelY / PLOT_SIZE) * (AXIS_RANGE * 2) - AXIS_RANGE);

    // 3. Update Text and Get Image
    // (Optimization: In a real app, you might want to debounce this slightly)
    setHoverCoords({ x, y });
    const imgData = await api.generateImage(x, y);
    setHoverImage(imgData);
  };

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => setIsHovering(false);

  const handleClick = () => {
    // When clicking, we lock in the current hover coords
    if (hoverCoords) {
        setExactClick({ ...hoverCoords });
    }
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
      <div style={{ padding: '20px', position: 'relative' }}>
        
        {/* FLOATING PREVIEW */}
        {isHovering && hoverImage && (
          <div style={{
            position: 'fixed',
            left: mousePos.x,
            top: mousePos.y,
            pointerEvents: 'none',
            zIndex: 9999,
            background: 'white',
            padding: '5px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            border: '1px solid #ccc'
          }}>
            <img
              src={hoverImage}
              style={{ width: '120px', height: '120px', display: 'block', borderRadius: '4px' }}
            />
            <div style={{ fontSize: '10px', color: '#ccc', marginTop: '4px', textAlign: 'center' }}>
              {hoverCoords?.x.toFixed(2)}, {hoverCoords?.y.toFixed(2)}
            </div>
          </div>
        )}

        {/* MAP CONTAINER */}
        <div
            onMouseMove={handleMouseMove}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick}
            style={{ 
                width: PLOT_SIZE, 
                height: PLOT_SIZE, 
                border: '1px solid #ccc',
                background: 'white',
                cursor: 'crosshair !important',
                position: 'relative',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
            className='map-container'
        >
          <style>{`
            .map-container .js-plotly-plot .plotly .cursor-crosshair {
              cursor: crosshair !important;
            }
            .map-container * {
              cursor: crosshair !important;
            }
          `}</style>

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
              hovermode: false,
              // IMPORTANT: Lock the axes and remove margins so math works
              xaxis: { range: [-AXIS_RANGE, AXIS_RANGE], fixedrange: true, visible: false },
              yaxis: { range: [-AXIS_RANGE, AXIS_RANGE], fixedrange: true, visible: false },
              margin: { l: 0, r: 0, t: 0, b: 0 }
            }}
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
        <p style={{color: '#242424ff', fontSize: '0.9em'}}>Fine-tune your latent vector.</p>

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
        
        {/* GENERATED IMAGE */}
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