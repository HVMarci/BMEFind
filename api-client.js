// API client for BMEFind backend
const API_BASE_URL = 'http://127.1.1.3/api.php';

// API wrapper functions
const API = {
    // Get buildings
    async getBuildings() {
        let url = `${API_BASE_URL}?path=buildings`;

        const response = await fetch(url);
        return await response.json();
    },

    // Get nodes, optionally filtered by building and floor
    async getNodes(epulet = null, emelet = null) {
        let url = `${API_BASE_URL}?path=nodes`;
        if (epulet) url += `&epulet=${encodeURIComponent(epulet)}`;
        if (emelet) url += `&emelet=${encodeURIComponent(emelet)}`;
        
        const response = await fetch(url);
        return await response.json();
    },
    
    // Get edges, optionally filtered by building and floor
    async getEdges(epulet = null, emelet = null) {
        let url = `${API_BASE_URL}?path=edges`;
        if (epulet) url += `&epulet=${encodeURIComponent(epulet)}`;
        if (emelet) url += `&emelet=${encodeURIComponent(emelet)}`;
        
        const response = await fetch(url);
        return await response.json();
    },
    
    // Save nodes (for dev UI)
    async saveNodes(nodes) {
        const response = await fetch(`${API_BASE_URL}?path=saveNodes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nodes })
        });
        return await response.json();
    },
    
    // Save edges (for dev UI)
    async saveEdges(edges) {
        const response = await fetch(`${API_BASE_URL}?path=saveEdges`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ edges })
        });
        return await response.json();
    }
};

// Load all data from backend
async function loadBackendData() {
    try {
        // Load nodes
        nodeData = await API.getNodes();
        
        // Load edges and build adjacency list
        const edgesData = await API.getEdges();
        buildingGraph = {};
        
        for (const edge of edgesData) {
            const from = edge.node_from;
            const to = edge.node_to;
            
            if (!buildingGraph[from]) {
                buildingGraph[from] = [];
            }
            buildingGraph[from].push(to);

            if (!buildingGraph[to]) {
                buildingGraph[to] = [];
            }
            buildingGraph[to].push(from);
        }

        // Load buildings
        epuletekData = await API.getBuildings();
    } catch (error) {
        console.error('Error loading backend data:', error);
    }
}

function findNodeById(id) {
    return nodeData.find(room => room.id == id);
}

function findImageFilename(epulet, emelet) {
    return epuletekData.find(building => 
        building.epulet === epulet && building.emelet === emelet
    );
}

function getDefaultMapFilename() {
    const kampusz = epuletekData.find(building => building.epulet === 'KAMPUSZ');
    return kampusz ? kampusz.filename : 'map_en.png';
}

// Export functions and data for use in main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        API,
        loadBackendData,
        findNodeById: findNodeById,
        findImageFilename,
        getDefaultMapFilename,
        getNodeData: () => nodeData,
        getGraph: () => buildingGraph
    };
}
