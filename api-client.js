// API client for BMEFind backend
const API_BASE_URL = './api.php';

// Room search helpers (shared by index.html + dev.html)
window.RoomSearch = window.RoomSearch || {};
window.RoomSearch.IGNORED_CHARS = ['.', '-', '/', ' '];
window.RoomSearch._ignoredCharSet = new Set(window.RoomSearch.IGNORED_CHARS);
window.RoomSearch.MIN_QUERY_LENGTH = 1;

window.RoomSearch.normalizeText = function(text) {
    if (text == null) return '';
    const s = text.toLowerCase();
    const out = [];
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (!window.RoomSearch._ignoredCharSet.has(ch)) out.push(ch);
    }
    return out.join('');
};

window.RoomSearch.ensureSearchKey = function(node) {
    if (!node || !node.room_name) return;
    if (typeof node.room_name_searchKey === 'string') return;
    node.room_name_searchKey = window.RoomSearch.normalizeText(node.room_name);
};

// API wrapper functions
const API = {
    // Get floors (one row per building+floor image)
    async getFloors() {
        let url = `${API_BASE_URL}?path=floors`;

        const response = await fetch(url, { credentials: 'include' });
        return await response.json();
    },

    // Get nodes, optionally filtered by building and floor
    async getNodes(building = null, floor = null) {
        let url = `${API_BASE_URL}?path=nodes`;
        if (building) url += `&building=${encodeURIComponent(building)}`;
        if (floor) url += `&floor=${encodeURIComponent(floor)}`;

        const response = await fetch(url, { credentials: 'include' });
        return await response.json();
    },

    // Get edges, optionally filtered by building and floor
    async getEdges(building = null, floor = null) {
        let url = `${API_BASE_URL}?path=edges`;
        if (building) url += `&building=${encodeURIComponent(building)}`;
        if (floor) url += `&floor=${encodeURIComponent(floor)}`;

        const response = await fetch(url, { credentials: 'include' });
        return await response.json();
    },

    // Authentication methods
    async login(username, password) {
        const response = await fetch(`${API_BASE_URL}?path=login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });
        return await response.json();
    },

    async logout() {
        const response = await fetch(`${API_BASE_URL}?path=logout`, {
            method: 'POST',
            credentials: 'include'
        });
        return await response.json();
    },

    async checkAuth() {
        const response = await fetch(`${API_BASE_URL}?path=checkAuth`, {
            credentials: 'include'
        });
        return await response.json();
    },

    // Save nodes (for dev UI)
    async saveNodes(nodes) {
        const response = await fetch(`${API_BASE_URL}?path=saveNodes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
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
            credentials: 'include',
            body: JSON.stringify({ edges })
        });
        return await response.json();
    },

    // Apply diff-based changes (for dev UI)
    async applyChanges(changes) {
        const response = await fetch(`${API_BASE_URL}?path=applyChanges`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(changes)
        });
        return await response.json();
    }
};

// Original data snapshots for diff calculation
let originalNodeData = [];
let originalBuildingGraph = {};

// Deep clone function for creating snapshots
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Load all data from backend
async function loadBackendData() {
    try {
        // Load nodes
        nodeData = await API.getNodes();
        if (Array.isArray(nodeData)) {
            nodeData.forEach(n => window.RoomSearch.ensureSearchKey(n));
        }

        // Load edges and build adjacency list
        const edgesData = await API.getEdges();
        buildingGraph = {};

        for (const edge of edgesData) {
            const from = edge.from_node_id;
            const to = edge.to_node_id;

            if (!buildingGraph[from]) {
                buildingGraph[from] = [];
            }
            buildingGraph[from].push(to);

            if (!buildingGraph[to]) {
                buildingGraph[to] = [];
            }
            buildingGraph[to].push(from);
        }

        // Load floors
        floorsData = await API.getFloors();

        // Store original snapshots for diff calculation
        originalNodeData = deepClone(nodeData);
        originalBuildingGraph = deepClone(buildingGraph);

        console.log('Data loaded - snapshots created for diff tracking');
    } catch (error) {
        console.error('Error loading backend data:', error);
    }
}

function findNodeById(id) {
    return nodeData.find(room => room.id == id);
}

function findFloorByBuildingAndFloor(building, floorName) {
    return floorsData.find(floor =>
        floor.building === building && floor.floor === floorName
    );
}

function getDefaultCampusFloor() {
    return floorsData.find(floor => floor.building === 'KAMPUSZ') || null;
}

// Calculate differences between current and original data
function calculateNodesDiff() {
    const added = [];
    const updated = [];
    const deleted = [];

    // Create lookup maps
    const currentMap = new Map(nodeData.map(n => [n.id, n]));
    const originalMap = new Map(originalNodeData.map(n => [n.id, n]));

    // Find added and updated nodes
    for (const node of nodeData) {
        const originalNode = originalMap.get(node.id);
        if (!originalNode) {
            // New node
            added.push(node);
        } else {
            // Check if modified
            const isModified =
                node.building !== originalNode.building ||
                node.floor !== originalNode.floor ||
                node.x !== originalNode.x ||
                node.y !== originalNode.y ||
                node.room_name !== originalNode.room_name ||
                String(node.node_type) !== String(originalNode.node_type);

            if (isModified) {
                updated.push(node);
            }
        }
    }

    // Find deleted nodes
    for (const originalNode of originalNodeData) {
        if (!currentMap.has(originalNode.id)) {
            deleted.push(originalNode.id);
        }
    }

    return { added, updated, deleted };
}

function calculateEdgesDiff() {
    const added = [];
    const deleted = [];

    // Convert graphs to edge sets for comparison
    function graphToEdgeSet(graph) {
        const edges = new Set();
        Object.keys(graph).forEach(fromId => {
            const neighbors = graph[fromId] || [];
            neighbors.forEach(toId => {
                // Normalize edge representation (smaller ID first)
                const edgeKey = [parseInt(fromId), parseInt(toId)].sort((a, b) => a - b).join('-');
                edges.add(edgeKey);
            });
        });
        return edges;
    }

    const currentEdges = graphToEdgeSet(buildingGraph);
    const originalEdges = graphToEdgeSet(originalBuildingGraph);

    // Find added edges
    for (const edgeKey of currentEdges) {
        if (!originalEdges.has(edgeKey)) {
            const [from, to] = edgeKey.split('-').map(Number);
            added.push({ from_node_id: from, to_node_id: to });
        }
    }

    // Find deleted edges
    for (const edgeKey of originalEdges) {
        if (!currentEdges.has(edgeKey)) {
            const [from, to] = edgeKey.split('-').map(Number);
            deleted.push({ from_node_id: from, to_node_id: to });
        }
    }

    return { added, deleted };
}

// Filter diffs by allowed buildings
function filterDiffsByPermissions(nodesDiff, edgesDiff, allowedBuildings) {
    const allowedSet = new Set(allowedBuildings);

    // Filter nodes
    const filteredNodes = {
        added: nodesDiff.added.filter(n => allowedSet.has(n.building)),
        updated: nodesDiff.updated.filter(n => allowedSet.has(n.building)),
        deleted: nodesDiff.deleted.filter(id => {
            // Check if deleted node was in an allowed building
            const originalNode = originalNodeData.find(n => n.id === id);
            return originalNode && allowedSet.has(originalNode.building);
        })
    };

    // Filter edges - both nodes must be in allowed buildings
    function edgeInAllowedBuildings(edge) {
        const fromNode = nodeData.find(n => n.id === edge.from_node_id) ||
                         originalNodeData.find(n => n.id === edge.from_node_id);
        const toNode = nodeData.find(n => n.id === edge.to_node_id) ||
                       originalNodeData.find(n => n.id === edge.to_node_id);

        return fromNode && toNode &&
               allowedSet.has(fromNode.building) &&
               allowedSet.has(toNode.building);
    }

    const filteredEdges = {
        added: edgesDiff.added.filter(edgeInAllowedBuildings),
        deleted: edgesDiff.deleted.filter(edgeInAllowedBuildings)
    };

    return { nodes: filteredNodes, edges: filteredEdges };
}

// Update snapshots after successful save
function updateSnapshots() {
    originalNodeData = deepClone(nodeData);
    originalBuildingGraph = deepClone(buildingGraph);
    console.log('Snapshots updated after save');
}

// Export functions and data for use in main app
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        API,
        loadBackendData,
        findNodeById: findNodeById,
        findFloorByBuildingAndFloor,
        getDefaultCampusFloor,
        getNodeData: () => nodeData,
        getGraph: () => buildingGraph
    };
}
