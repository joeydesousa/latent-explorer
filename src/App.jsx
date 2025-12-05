import React, { useState, useEffect } from 'react';
import Plot from 'react-plotly.js';
import { api } from './services/api';

const AXIS_RANGE = 10;
const VECTOR_SIZE = 10;

function App() {
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  const [modelList, setModelList] = useState([]);
  const [currentModel, setCurrentModel] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  // --- DATA STATE ---
  const [trainingData, setTrainingData] = useState([]); // The 500 persistent points
  const [cacheGrid, setCacheGrid] = useState([]);       // The 1024 cached preview images
  
  // --- STATE: VECTOR & CONFIG ---
  const [latentVector, setLatentVector] = useState(new Array(VECTOR_SIZE).fill(0));
  const [xAxisComp, setXAxisComp] = useState(0);
  const [yAxisComp, setYAxisComp] = useState(1);

  const [baseVector, setBaseVector] = useState([]); // 512-dim (Hidden)
  const [sliderValues, setSliderValues] = useState(new Array(VECTOR_SIZE).fill(0)); // 10-dim (Visible)

  const [sliderRanges, setSliderRanges] = useState(new Array(VECTOR_SIZE).fill(5.0));
  const currentXRange = sliderRanges[xAxisComp];
  const currentYRange = sliderRanges[yAxisComp];

  // --- STATE: OUTPUT ---
  const [exactClickImage, setExactClickImage] = useState(null);
  const [exactClickCoords, setExactClickCoords] = useState(null);
  const [editingFrameId, setEditingFrameId] = useState(null);

  // --- STATE: TIMELINE ---
  const [keyframes, setKeyframes] = useState([]);

  // --- STATE: FLOATING PREVIEW ---
  const [hoverImage, setHoverImage] = useState(null);
  const [hoverCoords, setHoverCoords] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);

  // --- STATE: VIDEO
  const [isRendering, setIsRendering] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);

  // Resize Handler
  useEffect(() => {
    const handleResize = () => setWindowHeight(window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Dynamic sizing
  const TIMELINE_HEIGHT = 250;

  const AVAILABLE_HEIGHT = windowHeight - TIMELINE_HEIGHT - 40;

  const PLOT_SIZE = AVAILABLE_HEIGHT;

  useEffect(() => {
    // Fetch available models on startup
    const fetchModels = async () => {
        const models = await api.getModels();
        setModelList(models);
        if (models.length > 0) setCurrentModel(models[0]);
    };
    fetchModels();
  }, []);

  // Load Map
  useEffect(() => {
    api.getTrainingData().then(data => setTrainingData(data));
  }, []);

  // Adjust to new axis
  /*
  useEffect(() => {
    const loadCache = async () => {
      setCacheGrid([]);
      // add buffer spinner?
      const newCache = await api.generateCacheGrid(xAxisComp, yAxisComp, currentXRange, currentYRange);
      setCacheGrid(newCache);
    };

    const timeoutId = setTimeout(loadCache, 50);
    return () => clearTimeout(timeoutId);

  }, [xAxisComp, yAxisComp, currentXRange, currentYRange]);
  */

  const handleModelChange = async (e) => {
    const newModel = e.target.value;
    setIsLoading(true);
    try {
      setCurrentModel(newModel);
      // Tell backend to switch
      await api.loadModel(newModel);
      // Optional: Refresh the map or cache here if the model architecture changes drastically
    } catch (e) {
          console.error(e);
          alert("Failed to load model");
      } finally {
          setIsLoading(false); // <--- STOP LOADING (Always)
      }
  };

  const handleFileUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setIsUploading(true);
      const success = await api.uploadModel(file);
      setIsUploading(false);

      if (success) {
          alert("Model uploaded successfully!");
          // Refresh list to show new model
          const models = await api.getModels();
          setModelList(models);
          // Automatically switch to it
          setCurrentModel(file.name);
          await api.loadModel(file.name);
      } else {
          alert("Upload failed.");
      }
  };

  // FIND NEAREST CACHE
  const findNearestCache = (x, y) => {
    if (cacheGrid.length === 0) return null;

    // nearest neighbour search
    let closest = null;
    let minDist = Infinity;

    // simple loop - try KD if using larger cache grid
    for (const point of cacheGrid) {
      const dx = point.x - x;
      const dy = point.y - y;
      const dist = dx*dx + dy*dy;
      if (dist < minDist) {
        minDist = dist;
        closest = point;
      }
    }
    return closest;
  };

  // --- HANDLER: MOUSE MOVE (Floating Preview) ---
  const handleMouseMove = async (e) => {
    // 1. Smart Tooltip Positioning
    const OFFSET = 20; const BOX_W = 140; const BOX_H = 160; 

    let finalX = e.clientX + OFFSET;
    let finalY = e.clientY + OFFSET;

    if (finalX + BOX_W > window.innerWidth) finalX = e.clientX - OFFSET - BOX_W;
    if (finalY + BOX_H > window.innerHeight) finalY = e.clientY - OFFSET - BOX_H;

    setMousePos({ x: finalX, y: finalY });

    // 2. Graph Coordinates Math
    const rect = e.currentTarget.getBoundingClientRect();
    const pixelX = e.clientX - rect.left;
    const pixelY = e.clientY - rect.top;

    const x = (pixelX / PLOT_SIZE) * (currentXRange * 2) - currentXRange;
    const y = -((pixelY / PLOT_SIZE) * (currentYRange * 2) - currentYRange);

    // 3. Get Preview (Using the cache grid)
    const nearest = findNearestCache(x, y);
    if (nearest) {
      setHoverCoords({ x: nearest.x, y: nearest.y });
      setHoverImage(nearest.image);
    }
  };

  const handleMouseEnter = () => setIsHovering(true);
  const handleMouseLeave = () => setIsHovering(false);

  // --- HANDLER: CLICK (Selection) ---
  const handleContainerClick = async (e) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      setVideoUrl(null)

      const rect = e.currentTarget.getBoundingClientRect();
      const pixelX = e.clientX - rect.left;
      const pixelY = e.clientY - rect.top;
      const x = (pixelX / PLOT_SIZE) * (currentXRange * 2) - currentXRange;
      const y = -((pixelY / PLOT_SIZE) * (currentYRange * 2) - currentYRange);

      // Update Main State
      const newVector = [...latentVector];
      newVector[xAxisComp] = x;
      newVector[yAxisComp] = y;
      setLatentVector(newVector);
      setExactClickCoords({ x, y });

      // 1. Ask Backend: "What is the DNA at this map position?"
      const newBase = await api.getVectorFromMap(x, y, xAxisComp, yAxisComp);
      setBaseVector(newBase);

      // 2. Reset Sliders to 0 (We are starting fresh at this map location)
      const zeroSliders = new Array(VECTOR_SIZE).fill(0);
      setSliderValues(zeroSliders);

      // 3. Generate High Res
      const imgData = await api.generateEditedImage(newBase, zeroSliders);
      setExactClickImage(imgData);
      
      // Reset edit mode
      setEditingFrameId(null);
    } catch (e) {
          console.error(e);
          alert("Failed to generate base image");
      } finally {
          setIsLoading(false); // <--- STOP LOADING (Always)
      }
  };

  // RANDOMISE HANDLER
  const handleRandomize = async () => {
    setIsLoading(true);
    try {
      // 1. Get new DNA
      const newBase = await api.getRandomVector();
      setBaseVector(newBase);
      
      // 2. Reset Sliders to 0
      const zeroSliders = new Array(VECTOR_SIZE).fill(0);
      setSliderValues(zeroSliders);
      
      // 3. Generate
      const img = await api.generateEditedImage(newBase, zeroSliders);
      setExactClickImage(img);
      
      // Optional: Clear selection markers
      setExactClickCoords(null);
    } catch (e) {
      console.error(e);
      alert("Failed to randomize");
    } finally {
      setIsLoading(false); // <--- STOP LOADING (Always)
    }
  };

  // set coarseness multipliers
  const fine = 1 / AXIS_RANGE
  const normal = 1
  const coarse = 3

  // --- HANDLER: COARSE/FINE MULTIPLIER
  const updateSliderRange = (index, type) => {
    const newRanges = [...sliderRanges];
    if (type === 'fine') newRanges[index] = AXIS_RANGE * fine;
    if (type === 'normal') newRanges[index] = AXIS_RANGE * normal;
    if (type === 'coarse') newRanges[index] = AXIS_RANGE * coarse;
    setSliderRanges(newRanges);
  };

  const getRangeType = (val) => {
    if (val === AXIS_RANGE * fine) return 'fine';
    if (val === AXIS_RANGE * coarse) return 'coarse';
    return 'normal';
  };

  const handleSliderChange = async (index, value) => {
    setIsLoading(true);
    try {
      const newSliders = [...sliderValues];
      newSliders[index] = parseFloat(value);
      setSliderValues(newSliders);
      
      // Send BOTH vectors
      const img = await api.generateEditedImage(baseVector, newSliders);
      setExactClickImage(img);
    } catch (e) {
      console.error(e);
      alert("Failed to edit vectors");
    } finally {
      setIsLoading(false); // <--- STOP LOADING (Always)
    }
  };

  // Add Keyframe
  const saveKeyframe = () => {
    if (!exactClickImage) return; // make sure an image is selected before adding

    // EDITING EXISITING KEYFRAME
    if (editingFrameId !== null) {
      const updatedFrames = keyframes.map(frame => {
        if (frame.id === editingFrameId) {
          return {
            ...frame,
            base_vector: [...baseVector],      // SAVE BASE
            slider_values: [...sliderValues],  // SAVE SLIDERS
            image: exactClickImage
          };
        }
        return frame;
      });
      setKeyframes(updatedFrames);
      setEditingFrameId(null); // exit edit mode
    }

    // ADDING NEW KEYFRAME
    else {
    const frameData = {
      id: Date.now(),
      base_vector: [...baseVector],      // SAVE BASE
      slider_values: [...sliderValues],  // SAVE SLIDERS
      image: exactClickImage,
      duration: 2.0
    }
      setKeyframes([...keyframes, frameData])
    }
  };

  // change keyframe duration
  const updateDuration = (index, val) => {
    const newFrames = [...keyframes];
    newFrames[index].duration = parseFloat(val);
    setKeyframes(newFrames);
  };

  // swap keyframes
  const moveKeyframe = (index, direction) => {
    if (index + direction < 0 || index + direction >= keyframes.length) return; // make sure not to move first left or last right

    const newFrames = [...keyframes];

    const temp = newFrames[index];
    newFrames[index] = newFrames[index + direction];
    newFrames[index + direction] = temp;

    setKeyframes(newFrames);
  };

  const deleteKeyframe = (index) => {
    const newFrames = keyframes.filter((_, i) => i !== index);
    setKeyframes(newFrames);
  };

  const selectKeyframeForEdit = (frame) => {
    setBaseVector([...frame.base_vector]);        // Restore Base
    setSliderValues([...frame.slider_values]);    // Restore Sliders
    setExactClickImage(frame.image);
    setExactClickCoords(null);
    setEditingFrameId(frame.id);
  };

  // --- HANDLER: RENDER
  const handleRenderVideo = async () => {
    if (keyframes.length < 2) {
      alert("Add at least 2 keyframes to render a video.");
      return;
    }

    setIsRendering(true);
    setVideoUrl(null);
    
    try {
      const url = await api.renderVideo(keyframes);
      setVideoUrl(url);
    } catch (error) {
      console.error("Render failed:", error);
      alert("Render failed!");
    } finally {
      setIsRendering(false);
    }
  };

  // --- HANDLER: DOWNLOAD ---
  const handleDownloadVideo = async () => {
    if (!videoUrl) return;

    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();

      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = "latent-exploration.mp4";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(blobUrl);

    } catch (error) {
      console.error("Download failed:", error);
      alert("Could not download video. Try right-clicking the video player and selecting 'Save Video As'.");
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      fontFamily: 'sans-serif',
      overflow: 'hidden',
      background: '#f5f5f5'
      }}>
      
      {/* TOP SECTION: COLUMNS */}
      <div style ={{ height: `calc(100vh - (${TIMELINE_HEIGHT} + 40)px)`, display: 'flex', overflow: 'hidden' }}>
      
        {/* LEFT: MAP */}
        <div style={{ padding: '20px', position: 'relative' }}>
          
          {/* FLOATING TOOLTIP */}
          {isHovering && hoverImage && (
              <div style={{
                  position: 'fixed',
                  left: mousePos.x,
                  top: mousePos.y,
                  pointerEvents: 'none', // Allows clicks to pass through!
                  zIndex: 9999,
                  background: 'white',
                  padding: '5px',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  border: '1px solid #ccc'
              }}>
                  <img src={hoverImage} style={{ width: '120px', height: '120px', display: 'block', borderRadius: '4px' }} />
                  <div style={{ fontSize: '10px', color: '#333', marginTop: '4px', textAlign: 'center' }}>
                      <strong>SNAP:</strong> {hoverCoords?.x.toFixed(2)}, {hoverCoords?.y.toFixed(2)}
                  </div>
              </div>
          )}

          <div 
              onMouseMove={handleMouseMove}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
              onClick={handleContainerClick}
              style={{ 
                  width: PLOT_SIZE, height: PLOT_SIZE, 
                  border: '1px solid #ccc', background: 'white', 
                  cursor: 'crosshair', position: 'relative'
              }}
          >
              <Plot
                data={[
                // Trace 1: Map Points (Green)  
                {
                  x: trainingData.map(vec => vec[xAxisComp]), 
                  y: trainingData.map(vec => vec[yAxisComp]),
                  type: 'scatter', mode: 'markers', marker: { color: '#2ecc71', opacity: 0.6, size: 6 }, hoverinfo: 'none'
                },
                // Trace 2: Current Selection (Red Cross)
                {
                  x: [latentVector[xAxisComp]],
                  y: [latentVector[yAxisComp]],
                  type: 'scatter',
                  mode: 'markers',
                  marker: {
                    color: 'red',
                    size: 15,
                    symbol: 'x',
                    line: { width: 3, color: 'white' }
                  },
                  hoverinfo: 'none'
                }
              ]}
                layout={{ 
                  width: PLOT_SIZE, height: PLOT_SIZE, title: false, showlegend: false,
                  xaxis: { range: [-currentXRange, currentXRange], fixedrange: true, visible: false },
                  yaxis: { range: [-currentYRange, currentYRange], fixedrange: true, visible: false },
                  margin: { l: 0, r: 0, t: 0, b: 0 },
                  hovermode: false
                }}
                config={{ displayModeBar: false }}
              />
          </div>
        </div>

        {/* CENTER: CONTROLS */}
        <div style={{ 
            flex: 1, 
            borderRight: '1px solid #e0e0e0', 
            display: 'flex',          // 1. Make the column a flex container
            flexDirection: 'column',  // 2. Stack items vertically
            overflow: 'hidden'        // 3. Prevent the whole column from scrolling
        }}>
          
          {/* TOP: FIXED HEADER (Axes Selection) */}
          <div style={{ 
            padding: '20px', 
            background: '#f5f5f5', // Match background or make slightly darker
            borderBottom: '1px solid #ddd',
            zIndex: 10 // Ensure it stays on top visually
          }}>

            <div style={{
                display: 'flex', justifyContent: 'space-between', gap: 10,
                background: 'white',
                marginBottom: 15, padding: 10,
                borderRadius: 8, border: '1px solid #ddd'
                }}>                
                <div style={{flex: 1, gap: '5px', marginBottom: '10px'}}>
                    <select 
                        value={currentModel} 
                        onChange={handleModelChange}
                        style={{flex: 1, padding: '5px', borderRadius: '4px', border: '1px solid #ccc'}}
                    >
                        {modelList.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>

                {/* UPLOAD BUTTON */}
                <div style={{position: 'relative', overflow: 'hidden', display: 'inline-block', width: '100%'}}>
                    <button style={{
                        width: '100%', padding: '8px', 
                        background: isUploading ? '#ccc' : '#e0e7ff', 
                        color: isUploading ? '#666' : '#4f46e5',
                        border: '1px dashed #4f46e5', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
                    }}>
                        {isUploading ? "Uploading..." : "⬆ Upload New Model"}
                    </button>
                    {/* Invisible file input covering the button */}
                    <input 
                        type="file" 
                        accept=".pkl, .pth"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        style={{
                            position: 'absolute', top: 0, left: 0, 
                            width: '100%', height: '100%', opacity: 0, cursor: 'pointer'
                        }} 
                    />
                </div>
            </div>

            <div style={{background: '#e0e0e0', padding: 10, borderRadius: 8}}>

              <div style={{display: 'flex', alignItems: 'center', marginBottom: 10}}>
                <label style={{width: '50px', fontSize:'0.9em', fontWeight: 'bold', color: '#000'}}>X-Axis: </label>
                <select
                value={xAxisComp}
                onChange={(e) => setXAxisComp(parseInt(e.target.value))}
                style={{flex: 1, padding: '5px'}}
                >
                  {sliderValues.map((_, i) => <option key={i} value={i}>Component {i}</option>)}
                </select>
              </div>
              
              <div style={{display: 'flex', alignItems: 'center'}}>
                <label style={{width: '50px', fontSize:'0.9em', fontWeight: 'bold', color: '#000'}}>Y-Axis: </label>
                <select
                  value={yAxisComp}
                  onChange={(e) => setYAxisComp(parseInt(e.target.value))}
                  style={{flex: 1, padding: '5px'}}
                >
                  {sliderValues.map((_, i) => <option key={i} value={i}>Component {i}</option>)}
                </select>
              </div>

              <button 
                onClick={handleRandomize}
                disabled={isLoading}
                style={{
                    width: '100%', padding: '12px', marginBottom: '20px',
                    background: isLoading ? '#ccc' : 'linear-gradient(45deg, #ec4899, #8b5cf6)', // Pink/Purple gradient
                    color: 'white', border: 'none', borderRadius: '6px',
                    fontWeight: 'bold', cursor: isLoading ? 'not-allowed' : 'pointer', fontSize: '1em'
                }}
              >
                  🎲 New Random Image
              </button>

            </div>
          </div>

          {/* BOTTOM: SCROLLABLE LIST (Sliders) */}
          <div style={{ 
            flex: 1,            // 4. Fill the remaining space
            overflowY: 'auto',  // 5. Scroll ONLY this area
            padding: '20px'
          }}>
            {sliderValues.map((val, i) => (
              <div key={i} style={{display: 'flex', gap: 10, marginBottom: '15px' }}>
                <div style={{ flex:1 }}>
                  <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '5px'}}>
                    <label style={{
                      fontSize: '0.9em', 
                      fontWeight: (i === xAxisComp || i === yAxisComp) ? 'bold' : 'normal', 
                      color: (i === xAxisComp || i === yAxisComp) ? 'blue' : 'black'
                    }}>
                      Component {i} 
                      {(i === xAxisComp) && " [X]"}
                      {(i === yAxisComp) && " [Y]"}
                    </label>
                    <span style={{fontSize: '0.8em', color: '#666'}}>{val.toFixed(2)}</span>
                  </div>
                  <input 
                    type="range"
                    min={-sliderRanges[i]} 
                    max={sliderRanges[i]} 
                    step={sliderRanges[i] === 1.0 ? 0.01 : 0.1}
                    value={val}
                    disabled={isLoading}
                    onChange={(e) => handleSliderChange(i, e.target.value)}
                    style={{width: '100%', cursor: isLoading ? 'wait' : 'pointer', opacity: isLoading ? 0.5 : 1}} 
                  />
                </div>
                <select
                  value={getRangeType(sliderRanges[i])}
                  onChange={(e) => updateSliderRange(i, e.target.value)}
                  style={{
                    fontSize: '0.9em',
                    padding: '2px 6px', marginTop: '10px', marginBottom: '10px',
                    borderRadius: '4px',
                    color: '#000',
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="fine">Fine</option>
                  <option value="normal">Normal</option>
                  <option value="coarse">Coarse</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: OUTPUT */}
        <div style={{ flex: 1, padding: '20px', background: 'white', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* --- LOADING OVERLAY --- */}
            {isLoading && (
                <div style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(255, 255, 255, 0.8)', // Semi-transparent white
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    zIndex: 50, // Sit on top of everything
                    backdropFilter: 'blur(2px)' // Nice blur effect
                }}>
                    <div style={{
                        width: '40px', height: '40px',
                        border: '4px solid #f3f3f3',
                        borderTop: '4px solid #4f46e5', // Blue spinner
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                    }} />
                    <p style={{marginTop: '10px', color: '#4f46e5', fontWeight: 'bold'}}>Generating...</p>
                    {/* Add keyframes for spin animation */}
                    <style>{`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            )}
          
          <div style={{ padding: '15px', background: '#eef2ff', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
            
            {/* CONDITION 1: IS RENDERING */}
            {isRendering ? (
              <div style={{
                width: '100%', aspectRatio: '1/1',
                background: '#ddd',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                borderRadius: '4px', color: '#666'
              }}>
                <div className="spinner">⚙️</div> {/* still need to animate with css */}
                <p style={{marginTop: 10, fontSize: '0.9em'}}>Rendering...</p>
              </div>
            ) :

            /* Condition 2: SHOW VIDEO */
            videoUrl ? (
              <>
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  style={{ width: '100%', borderRadius: '4px', border: '1px solid #ccc'}}
                />
                <button
                  onClick={handleDownloadVideo}
                  style={{
                    marginTop: '10px', width: '100%', padding: '8px',
                    background: 'transparent', border: '1px solid #999', color: '#666',
                    borderRadius: '4px', cursor: 'pointer'
                  }}
                >
                  Download MP4 💾
                </button>
              </>
            ) :

            exactClickImage ? (
              <>
                <img src={exactClickImage} style={{ width: '100%', borderRadius: '4px', border: '1px solid #c7d2fe' }} />
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                  <p style={{fontSize: '0.8em', color: '#666'}}>
                    Vector: [{sliderValues.map(v => v.toFixed(1)).join(', ')}]
                  </p>
                  <button
                    onClick={saveKeyframe}
                    style={{
                      background: '#4f46e5', color: 'white', border: 'none',
                      padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'
                    }}>
                    {editingFrameId !== null ? "💾 Save Keyframe" : "+ Add Keyframe"}
                  </button>
                </div>
              </>
            ) : (
              <p>Click map to start</p>
            )}
          </div>
        </div>

      </div>

      {/* BOTTOM SECTION: TIMELINE */}
      <div style={{
        height: `${TIMELINE_HEIGHT}px`,
        background: '#1e293b',
        borderTop: '2px solid #475569',
        padding: '10px',
        display: 'flex',
        flexDirection: 'row',
        zIndex: 20
      }}>

        {/* Scrollable Keyframe Timeline */}
        <div style={{
          flex: 1,
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          paddingBottom: '10px',
          alignItems: 'center'
        }}>
          {/* Show message if empty */}
          {keyframes.length === 0 && (
            <div style={{color: '#64748b', margin: 'auto'}}>No keyframes added yet.</div>
          )}

          {/* Loop through frames */}
          {keyframes.map((frame, index) => (
            <div
              key={frame.id}
              style={{
                minWidth: '140px',
                background: '#334155',
                borderRadius: '8px',
                padding: '8px',
                display: 'flex', flexDirection: 'column', gap: '5px',
                position: 'relative'
              }}
            >
              {/* Frame index and Delete */}
              <div style={{color: '#94a3b8', fontSite: '0.7em', display: 'flex', justifyContent: 'space-between'}}>
                <span>Frame {index + 1}</span>
                <button onClick={() => deleteKeyframe(index)} style={{background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer'}}>✕</button>
              </div>

              {/* Thumbnail */}
              <img
                src={frame.image}
                onClick={() => selectKeyframeForEdit(frame)}
                style={{
                  width: '100%', height: '80px',
                  objectFit: 'cover', borderRadius: '4px',
                  background: 'black', cursor: 'pointer'
                }}
              />

              {/* Keyframe Swap Arrows and Duration Input */}
              <div style={{display: 'flex', gap: '5px', justifyContent: 'space-between', marginTop: '2px'}}>
                <button
                  onClick={() => moveKeyframe(index, -1)}
                  disabled={index === 0}
                  style={{background: '#475569', color: 'white', border: 'none', borderRadius: '3px', cursor: index === 0 ? 'default' : 'pointer', opacity: index === 0 ? 0.3 : 1}}
                  >←</button>
                  {index > 0 ? (
                    <>
                      <input
                        type="number"
                        value={frame.duration}
                        onChange={(e) => updateDuration(index, e.target.value)}
                        style={{width: '40px', fontSize: '0.7em', padding: '2px'}}
                      />
                    </>
                  ) : (
                    <span style={{color: '#64748b', fontSize: '0.7em'}}>Start Frame</span>
                  )}
                  <button
                  onClick={() => moveKeyframe(index, 1)}
                  disabled={index === keyframes.length - 1}
                  style={{background: '#475569', color: 'white', border: 'none', borderRadius: '3px', cursor: index === keyframes.length - 1 ? 'default' : 'pointer', opacity: index === keyframes.length - 1 ? 0.3 : 1}}
                  >→</button>
              </div>
            </div>
          ))}
        </div>

        {/* Right Side Bar */}
        <div style={{color: 'white', marginBottom: '10px', display: 'flex', flexDirection: 'column'}}>
          <strong>({keyframes.length} frames)</strong>
          <button 
            onClick={handleRenderVideo}
            disabled={isRendering}
            style = {{background: isRendering ? '#94a3b3' : '#212324ff',
              color: 'white', border: 'none', padding: '5px 15px',
              borderRadius: '4px',marginTop: '20px',
              cursor: isRendering ? 'not-allowed' : 'pointer'
            }}
          >
            {isRendering ? "Processing..." : "Render Video"}
          </button>
        </div>

      </div>

    </div>
  );
}

export default App;