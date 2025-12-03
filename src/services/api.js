const LATENT_DIM = 10; 
const CACHE_GRID_SIZE = 32; // 32x32 = 1024 images
const RANGE = 5; // -5 to +5

const USE_MOCK = false;

const SERVER_URL = "https://joeydesousa-art-gan-backend.hf.space";

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
    // 1. Get the "Real" Training Data (Full Vectors)
    getTrainingData: async () => {
        return trainingData;
    },

    // 2. Generate the Cache Grid (The "Baking" process)
    // This simulates the heavy Python process of pre-rendering 1024 images
    generateCacheGrid: async (xAxis, yAxis) => {
        const cache = [];
        const allVectors = [];
        const allCoords = [];

        console.log(`Preparing batch request...`)
        
        // Loop through the grid
        for (let i = 0; i < CACHE_GRID_SIZE; i++) {
            for (let j = 0; j < CACHE_GRID_SIZE; j++) {
                // Calculate grid position (-5 to +5)
                const xVal = (i / (CACHE_GRID_SIZE - 1)) * (RANGE * 2) - RANGE;
                const yVal = (j / (CACHE_GRID_SIZE - 1)) * (RANGE * 2) - RANGE;
                
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
            return generateMockImageFromVector(vector);
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
            const data = await response.json();
            return data.image;
        } catch (error) {
            console.error("API Error:", error);
            return null;
        }

    },

    // 4. Video Rendering
    renderVideo: async (keyframes) => {
        console.log("Rendering video with keyframes:", keyframes);

        // 1. Simulate server delay
        await new Promise(resolve => setTimeout(resolve, 3000));

        //2. Return video URL - for now a fake
        return "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";
    }
};