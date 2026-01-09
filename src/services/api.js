const LATENT_DIM = 10; 
const CACHE_GRID_SIZE = 10; // 32x32 = 1024 images
// const RANGE = 5; // -5 to +5
const CHUNK_SIZE = 10

const USE_MOCK = false;

const SERVER_URL = "http://localhost:8000";

// --- HELPER: COLOR GENERATOR (Same as before) ---
const generateMockImageFromVector = (vector) => {
    const normalize = (val) => Math.min(255, Math.max(0, ((val + 5) / 10) * 255));
    let r = normalize(vector[0] || 0); 
    let g = normalize(vector[1] || 0); 
    let b = normalize(vector[2] || 0); 
    const brightness = (vector[3] || 0) * 20; 
    
    const canvas = document.createElement('canvas');
    canvas.width = 64; // Small size for cache performance
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `rgb(${r+brightness},${g+brightness},${b+brightness})`;
    ctx.fillRect(0, 0, 64, 64);
    return canvas.toDataURL('image/png');
};

// --- DATA PERSISTENCE ---
// We generate the "Training Data" once so it stays consistent when switching axes
const trainingData = [];
for (let i = 0; i < 500; i++) {
    // Create a random 10-dimensional vector
    const vector = Array.from({length: LATENT_DIM}, () => (Math.random() - 0.5) * 10);
    trainingData.push(vector);
}

export const api = {

    getModels: async () => {
        if (USE_MOCK) return ["mock_seaweed_v1.pkl", "mock_faces.pkl"];
        try {
            const res = await fetch(`${SERVER_URL}/models`);
            const data = await res.json();
            return data.models;
        } catch (e) {
            console.error("Failed to fetch models:", e);
            return [];
        }
    },

    uploadModel: async (file) => {
        if (USE_MOCK) {
            console.log("Mock upload:", file.name);
            return true;
        }
        
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${SERVER_URL}/upload_model`, {
                method: 'POST',
                body: formData, // No headers! Fetch adds multipart/form-data automatically
            });
            return res.ok;
        } catch (e) {
            console.error("Upload failed:", e);
            return false;
        }
    },

    loadModel: async (filename) => {
        if (USE_MOCK) {
            console.log("Mock switch to:", filename);
            return true;
        }
        try {
            // Note: We send model_name as a query param or body depending on your FastAPI setup
            // Here we use query param for simplicity: /load_model?model_name=xyz
            const res = await fetch(`${SERVER_URL}/load_model?model_name=${encodeURIComponent(filename)}`, {
                method: 'POST'
            });
            return res.ok;
        } catch (e) {
            console.error("Switch failed:", e);
            return false;
        }
    },

    // 1. Get the "Real" Training Data (Full Vectors)
    getTrainingData: async () => {
        return trainingData;
    },

    // 2. Generate the Cache Grid (The "Baking" process)
    // This simulates the heavy Python process of pre-rendering 1024 images
    generateCacheGrid: async (xAxis, yAxis, rangeX, rangeY) => {
        const cache = [];
        const allVectors = [];
        const allCoords = [];

        console.log(`Preparing batch request...`)
        
        // Loop through the grid
        for (let i = 0; i < CACHE_GRID_SIZE; i++) {
            for (let j = 0; j < CACHE_GRID_SIZE; j++) {
                // Calculate grid position (-5 to +5)
                const xVal = (i / (CACHE_GRID_SIZE - 1)) * (rangeX * 2) - rangeX;
                const yVal = (j / (CACHE_GRID_SIZE - 1)) * (rangeY * 2) - rangeY;
                
                // Create a vector that is 0 everywhere EXCEPT the two chosen axes
                const vector = new Array(LATENT_DIM).fill(0);
                vector[xAxis] = xVal;
                vector[yAxis] = yVal;
                
                // Save array of vectors
                allVectors.push(vector);
                allCoords.push({ x: xVal, y: yVal });
            }
        }

        if (!USE_MOCK) {
            for (let i = 0; i < allVectors.length; i += CHUNK_SIZE) {
                const vectorChunk = allVectors.slice(i, i + CHUNK_SIZE);
                const coordChunk = allCoords.slice(i, i + CHUNK_SIZE);

                try {
                    const response = await fetch(`${SERVER_URL}/generate_batch`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json' },
                        body: JSON.stringify({ vectors: vectorChunk })
                    });
                    const data = await response.json() ;

                    if (!response.ok) {
                        // Read the error text (HTML/String) from the server
                        const errorText = await response.text();
                        console.error("Server Error:", errorText);
                        throw new Error(`Server responded with ${response.status}: ${errorText}`);
                    }

                    // Match images back to coordinates
                    data.images.forEach((imgBase64, index) => {
                        cache.push({
                            x: coordChunk[index].x,
                            y: coordChunk[index].y,
                            image: imgBase64
                        });
                    });

                    console.log(`Loaded chunk ${i / CHUNK_SIZE + 1}`);

                } catch (error) {
                    console.error("Chunk failed", error);
                }
            }
        } else {
            allVectors.forEach((vec, idx) => {
                const img = generateMockImageFromVector(vec);
                cache.push({
                    x: allCoords[idx].x,
                    y: allCoords[idx].y,
                    image: img
                });
            });
        }
        
        return cache;
    },

    // 3. Exact Generation (For clicks)
    generateImage: async (vector) => {

        if (USE_MOCK) {
            return generateMockImageFromVector(vector);
        }

        try {
            const response = await fetch(`${SERVER_URL}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vector: vector })
            });

            if (!response.ok) {
                // Read the error text (HTML/String) from the server
                const errorText = await response.text();
                console.error("Server Error:", errorText);
                throw new Error(`Server responded with ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            return data.image;
        } catch (error) {
            console.error("API Error:", error);
            return null;
        }

    },

    getRandomVector: async () => {
        if (USE_MOCK) return Array.from({length: 10}, () => Math.random());
        
        try {
            const res = await fetch(`${SERVER_URL}/random_vector`);
            if (!res.ok) throw new Error("Failed to get random vector");
            const data = await res.json();
            return data.vector;
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    getVectorFromMap: async (x, y, xComp, yComp) => {
        if (USE_MOCK) return Array.from({length: 10}, () => Math.random()); // Mock

        try {
            const res = await fetch(`${SERVER_URL}/map_to_vector`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    x: x, y: y, 
                    x_component: xComp, 
                    y_component: yComp 
                })
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            return data.vector; // Returns the 512-dim Base Vector
        } catch (e) {
            console.error(e);
            return [];
        }
    },

    // 2. Generate Edited Image
    generateEditedImage: async (baseVector, sliderValues) => {
        if (USE_MOCK) return generateMockImageFromVector(sliderValues); // Mock just uses sliders

        try {
            const response = await fetch(`${SERVER_URL}/generate_edited`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    base_vector: baseVector,
                    slider_values: sliderValues 
                })
            });
            if (!response.ok) throw new Error(await response.text());
            const data = await response.json();
            return data.image;
        } catch (error) {
            console.error("Edit generation failed:", error);
            return null;
        }
    },

    // 4. Video Rendering
    renderVideo: async (keyframes) => {
        if (USE_MOCK) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            return "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
        }

        console.log("Sending video request...");

        // 1. Clean the data (Remove the 'image' property to save bandwidth)
        const cleanKeyframes = keyframes.map(k => ({
            base_vector: k.base_vector,
            slider_values: k.slider_values, // Renamed from 'vector' for clarity
            duration: k.duration
        }));

        try {
            const response = await fetch(`${SERVER_URL}/render_video`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    keyframes: cleanKeyframes,
                    fps: 24 
                })
            });

            if (!response.ok) throw new Error(`Server Error: ${response.status}`);
            
            const data = await response.json();
            
            // 2. Construct the full URL
            // If the server returns a relative path like "/videos/vid.mp4",
            // append it to the SERVER_URL.
            return `${SERVER_URL}${data.url}`;

        } catch (error) {
            console.error("Video Render Failed:", error);
            return null;
        }
    }
    
    /*
    renderVideo: async (keyframes) => {
        console.log("Rendering video with keyframes:", keyframes);

        // 1. Simulate server delay
        await new Promise(resolve => setTimeout(resolve, 3000));

        //2. Return video URL - for now a fake
        return "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
    }
    */
};
