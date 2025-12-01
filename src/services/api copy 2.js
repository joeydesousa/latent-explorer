// --- CONFIGURATION ---
const LATENT_DIM = 10; // Number of "sliders" or components

// --- HELPER: MOCK IMAGE GENERATOR ---
// This acts as your "Decoder". It takes a vector and returns a Base64 Image.
const generateMockImageFromVector = (vector) => {
    // 1. Math: Map vector values (-5 to +5) to Color values (0 to 255)
    // We define what each component does here.
    
    // Normalize -5 to +5 range into 0 to 255
    const normalize = (val) => Math.min(255, Math.max(0, ((val + 5) / 10) * 255));

    // Map specific vector indices to specific visual traits
    let r = normalize(vector[0] || 0); // Component 0 controls Red
    let g = normalize(vector[1] || 0); // Component 1 controls Green
    let b = normalize(vector[2] || 0); // Component 2 controls Blue
    
    // Component 3 controls Brightness (adds to all channels)
    const brightness = (vector[3] || 0) * 20; 
    r += brightness;
    g += brightness;
    b += brightness;

    // 2. Create an Image using HTML Canvas (In-memory)
    const canvas = document.createElement('canvas');
    canvas.width = 128; // Simulate VAE size
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Fill with the calculated color
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, 128, 128);

    // OPTIONAL: Add text to show stats (helps debugging)
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText(`R:${r.toFixed(0)} G:${g.toFixed(0)} B:${b.toFixed(0)}`, 5, 120);

    // 3. Return Base64 string (Data URL)
    return canvas.toDataURL('image/png');
};

export const api = {
    // Generate random map points (Mock UMAP)
    getMapData: async () => {
        const points = [];
        // Generate 500 random points for the scatter plot
        for (let i = 0; i < 500; i++) {
            points.push({
                x: (Math.random() - 0.5) * 10,
                y: (Math.random() - 0.5) * 10
            });
        }
        return points;
    },

    // --- THE MAIN FUNCTION ---
    // Takes the FULL vector (sliders + map coordinates)
    generateImage: async (vector) => {
        // In the future, this is where you connect to Python:
        /*
        const response = await fetch(`${SERVER_URL}/generate`, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ vector: vector }) 
        });
        const data = await response.json();
        return data.image; 
        */
        
        // For now, run the mock generator locally
        return generateMockImageFromVector(vector);
    }
};