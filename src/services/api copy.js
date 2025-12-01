// Toggle this to switch between Mock and Real later
const USE_MOCK = true;
const SERVER_URL = "http://localhost:8000"; // Your future Python server

// --- 1. MOCK DATA GENERATOR ---
const generateMockMap = (count = 1000) => {
    const points = [];
    for (let i = 0; i < count; i++) {
        points.push({
            x: (Math.random() - 0.5) * 10,
            y: (Math.random() - 0.5) * 10,
            id: i
        });
    }
    return points;
};

// --- 2. THE API FUNCTIONS ---

export const api = {
    // Get the points for the scatter plot
    getMapData: async () => {
        if (USE_MOCK) {
            console.log("Mock API: Generating Map Data...");
            return generateMockMap();
        }
        const response = await fetch(`${SERVER_URL}/map_data`);
        return response.json();
    },

    // Get an image for a specific point (X, Y)
    generateImage: async (x, y, sliders = []) => {
        if (USE_MOCK) {
            console.log(`Mock API: Generating at ${x.toFixed(2)}, ${y.toFixed(2)} with sliders`, sliders);
            // Return a placeholder color based on coordinates (Just to show it changes!)
            const r = Math.abs(Math.sin(x) * 255);
            const g = Math.abs(Math.cos(y) * 255);
            return `rgb(${r}, ${g}, 100)`; 
            // In real life, this returns "data:image/png;base64,..."
        }
        
        // Prepare the payload for Python
        const response = await fetch(`${SERVER_URL}/generate`, {
            method: 'POST',
            body: JSON.stringify({ x, y, sliders })
        });
        const data = await response.json();
        return data.image; // Base64 string
    }
};