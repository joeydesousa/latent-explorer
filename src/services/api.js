const LATENT_DIM = 10; 
const CACHE_GRID_SIZE = 32; // 32x32 = 1024 images
const RANGE = 5; // -5 to +5

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
                
                // Generate the image
                const img = generateMockImageFromVector(vector);
                
                cache.push({ x: xVal, y: yVal, image: img });
            }
        }
        console.log(`Generated ${cache.length} cached images for Axes ${xAxis}/${yAxis}`);
        return cache;
    },

    // 3. Exact Generation (For clicks)
    generateImage: async (vector) => {
        return generateMockImageFromVector(vector);
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