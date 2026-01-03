// Development UI features
// This file contains development tools for debugging and mapping coordinate placement

// Track selected node for graph editing
let selectedNodeId = null;

// TODO move this to api-client.js
// Authentication state
let authState = {
    authenticated: false,
    user: null,
    buildingPermissions: [],
    isAdmin: false
};

// Initialize auth state on page load
async function initializeAuth() {
    try {
        const authResult = await API.checkAuth();
        updateAuthState(authResult);
        return authResult;
    } catch (error) {
        console.error('Failed to check auth:', error);
        const fallbackAuth = { authenticated: false, user: null, building_permissions: [] };
        updateAuthState(fallbackAuth);
        return fallbackAuth;
    }
}

// Master initialization - coordinates auth then data loading
async function initializeApplication() {
    // Mark that we're handling initialization (prevents app.js auto-init)
    window.appInitialized = true;

    try {
        console.log('Starting application initialization...');

        // Step 1: Check authentication FIRST (establishes session)
        console.log('Step 1: Checking authentication...');
        const authResult = await initializeAuth();
        console.log('Auth complete:', authResult.authenticated ? 'authenticated' : 'not authenticated');

        // Step 2: Load backend data (uses established session)
        console.log('Step 2: Loading backend data...');
        await window.initializeApp();
        console.log('Application initialization complete');

    } catch (error) {
        console.error('Application initialization failed:', error);
        alert('Hiba történt az alkalmazás betöltése során. Kérjük, frissítse az oldalt.');
    }
}

// Update auth state and UI
function updateAuthState(authResult) {
    authState.authenticated = authResult.authenticated;
    authState.user = authResult.user;
    authState.buildingPermissions = authResult.building_permissions || [];
    authState.isAdmin = !!(authResult.user && authResult.user.is_admin);

    updateAuthUI();
    updateSaveButtonState();
}

function canEditBuilding(epulet) {
    if (!authState.authenticated) return false;
    if (authState.isAdmin) return true;
    return authState.buildingPermissions.includes(epulet);
}

function getCurrentBuildingFromImage() {
    if (!currentImageFilename) return null;
    return epuletekData.find(b => b.filename === currentImageFilename) || null;
}

// Update auth UI elements
function updateAuthUI() {
    const authStatusText = document.getElementById('authStatusText');
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    const authStatus = document.getElementById('authStatus');

    if (authState.authenticated && authState.user) {
        let statusText = `Bejelentkezve: ${authState.user.display_name}`;
        if (authState.isAdmin) {
            statusText += ' (admin)';
        } else if (authState.buildingPermissions.length > 0) {
            statusText += ` (${authState.buildingPermissions.join(', ')})`;
        } else {
            statusText += ' (nincs jogosultság)';
        }
        authStatusText.textContent = statusText;
        loginButton.style.display = 'none';
        logoutButton.style.display = 'inline-block';
        authStatus.classList.add('authenticated');
    } else {
        authStatusText.textContent = 'Nem vagy bejelentkezve';
        loginButton.style.display = 'inline-block';
        logoutButton.style.display = 'none';
        authStatus.classList.remove('authenticated');
    }
}

// Update save button state based on permissions
function updateSaveButtonState() {
    const saveButton = document.getElementById('saveToDatabase');

    if (!authState.authenticated || (!authState.isAdmin && authState.buildingPermissions.length === 0)) {
        saveButton.classList.add('no-permissions');
        saveButton.disabled = true;
        saveButton.title = authState.authenticated
            ? 'Nincs jogosultságod egyetlen épülethez sem'
            : 'Bejelentkezés szükséges a mentéshez';
    } else {
        saveButton.classList.remove('no-permissions');
        saveButton.disabled = false;
        if (authState.isAdmin) {
            saveButton.title = 'Mentés (admin)';
            return;
        }
        saveButton.title = `Mentés (jogosultság: ${authState.buildingPermissions.join(', ')})`;
    }
}

// Show save result popup
function showSaveResultPopup(title, message, type) {
    const modal = document.getElementById('saveResultModal');
    const header = document.getElementById('saveResultHeader');
    const titleEl = document.getElementById('saveResultTitle');
    const messageEl = document.getElementById('saveResultMessage');

    titleEl.textContent = title;
    messageEl.textContent = message;

    // Remove previous type classes and add new one
    header.classList.remove('success', 'warning', 'error');
    header.classList.add(type);

    modal.style.display = 'block';
}

// Draw graph connections (green lines between connected nodes)
function drawGraphConnections() {
    if (!lastDrawnImage.img || !currentImageFilename) return;

    const scale = getImageScale();

    // Find the current building and floor from the current image
    const currentBuilding = epuletekData.find(b => b.filename === currentImageFilename);
    if (!currentBuilding || currentBuilding.epulet === 'KAMPUSZ') return;

    // Filter points that match current building and floor
    const relevantPoints = nodeData.filter(point =>
        point.epulet === currentBuilding.epulet && point.emelet === currentBuilding.emelet
    );

    // Draw connections between nodes
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = 4 * scale;
    
    relevantPoints.forEach(point => {
        const pointId = point.id;
        const neighbors = buildingGraph[pointId] || [];
        
        neighbors.forEach(neighborId => {
            const neighbor = nodeData.find(c => c.id === neighborId);
            
            // Only draw if neighbor is on the same floor (to avoid duplicate lines)
            if (neighbor && neighbor.epulet === point.epulet && 
                neighbor.emelet === point.emelet && neighbor.id > pointId) {

                const x1 = point.x;
                const y1 = point.y;
                const x2 = neighbor.x;
                const y2 = neighbor.y;
                
                // Convert to canvas coordinates
                const canvasX1 = lastDrawnImage.drawX + (x1 / lastDrawnImage.img.width) * lastDrawnImage.drawWidth;
                const canvasY1 = lastDrawnImage.drawY + (y1 / lastDrawnImage.img.height) * lastDrawnImage.drawHeight;
                const canvasX2 = lastDrawnImage.drawX + (x2 / lastDrawnImage.img.width) * lastDrawnImage.drawWidth;
                const canvasY2 = lastDrawnImage.drawY + (y2 / lastDrawnImage.img.height) * lastDrawnImage.drawHeight;
                
                ctx.beginPath();
                ctx.moveTo(canvasX1, canvasY1);
                ctx.lineTo(canvasX2, canvasY2);
                ctx.stroke();
            }
        });
    });
}

// Draw nodes for debugging
function drawNodes() {
    if (!lastDrawnImage.img || !currentImageFilename) return;

    const scale = getImageScale();

    // Find the current building and floor from the current image
    const currentBuilding = epuletekData.find(b => b.filename === currentImageFilename);
    if (!currentBuilding || currentBuilding.epulet === 'KAMPUSZ') return;

    // Filter points that match current building and floor
    const relevantPoints = nodeData.filter(point =>
        point.epulet === currentBuilding.epulet && point.emelet === currentBuilding.emelet
    );

    // Draw each point
    relevantPoints.forEach(point => {
        const x = point.x;
        const y = point.y;

        // Convert image coordinates to canvas coordinates
        const canvasX = lastDrawnImage.drawX + (x / lastDrawnImage.img.width) * lastDrawnImage.drawWidth;
        const canvasY = lastDrawnImage.drawY + (y / lastDrawnImage.img.height) * lastDrawnImage.drawHeight;

        // Draw green circle
        const radius = 30 * scale;
        ctx.fillStyle = 'green';
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw white border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 4 * scale;
        ctx.stroke();

        // Draw the ID text in white
        ctx.fillStyle = 'white';
        ctx.font = `bold ${24 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // For type 1, show "ID-teremnev", otherwise just ID
        let displayText = point.id;
        if (point.tipus === '1' && point.teremnev) {
            ctx.fillStyle = 'lightblue';
            displayText = `${point.id}-${point.teremnev}`;
        } else if (point.tipus === '2') {
            ctx.fillStyle = 'orange';
        }
        ctx.fillText(displayText, canvasX, canvasY);
    });
}

// Canvas click event listener - show coordinates when ALT is pressed, add node when CTRL is pressed
canvas.addEventListener('click', (event) => {
    if (!lastDrawnImage.img) return;
    
    // Get canvas position relative to viewport
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    
    // Check if click is within the drawn image
    if (canvasX < lastDrawnImage.drawX || canvasX > lastDrawnImage.drawX + lastDrawnImage.drawWidth ||
        canvasY < lastDrawnImage.drawY || canvasY > lastDrawnImage.drawY + lastDrawnImage.drawHeight) {
        return;
    }
    
    // Convert canvas coordinates to image coordinates
    const relativeX = canvasX - lastDrawnImage.drawX;
    const relativeY = canvasY - lastDrawnImage.drawY;
    
    const imageX = Math.floor((relativeX / lastDrawnImage.drawWidth) * lastDrawnImage.img.width);
    const imageY = Math.floor((relativeY / lastDrawnImage.drawHeight) * lastDrawnImage.img.height);
    
    // Show coordinates when ALT is pressed
    if (event.altKey) {
        alert(`${imageX},${imageY}`);
        return;
    }
    
    // Graph editing with SHIFT key
    if (event.shiftKey) {
        // Find if we clicked on a node
        const currentBuilding = getCurrentBuildingFromImage();
        if (!currentBuilding || currentBuilding.epulet === 'KAMPUSZ') return;
        if (!canEditBuilding(currentBuilding.epulet)) {
            alert(`Nincs jogosultságod a(z) ${currentBuilding.epulet} épület szerkesztéséhez.`);
            return;
        }

        let clickedNode = null;

        const relevantPoints = nodeData.filter(point =>
            point.epulet === currentBuilding.epulet && point.emelet === currentBuilding.emelet
        );

        // Check if click is near any node (within 30 image pixels)
        const clickRadius = 30 * getImageScale();
        for (const point of relevantPoints) {
            const x = point.x;
            const y = point.y;
            const nodeCanvasX = lastDrawnImage.drawX + (x / lastDrawnImage.img.width) * lastDrawnImage.drawWidth;
            const nodeCanvasY = lastDrawnImage.drawY + (y / lastDrawnImage.img.height) * lastDrawnImage.drawHeight;

            const distance = Math.sqrt(Math.pow(nodeCanvasX - canvasX, 2) + Math.pow(nodeCanvasY - canvasY, 2));
            if (distance < clickRadius) {
                clickedNode = point;
                break;
            }
        }
        
        if (clickedNode) {
            const clickedId = clickedNode.id;
            
            if (selectedNodeId === null) {
                // Select the clicked node
                selectedNodeId = clickedId;
                console.log(`Node ${clickedId} selected`);
                redrawCanvas();
            } else if (selectedNodeId === clickedId) {
                // Unselect the node
                selectedNodeId = null;
                console.log(`Node ${clickedId} unselected`);
                redrawCanvas();
            } else {
                // Connect the two nodes
                if (addGraphConnection(selectedNodeId, clickedId)) {
                    selectedNodeId = null;
                    redrawCanvas();
                }
            }
        } else {
            // Clicked on empty space - prompt for ID
            if (selectedNodeId !== null) {
                const targetId = prompt('Csúcs ID a csatlakozáshoz:', '');
                if (targetId !== null && targetId.trim() !== '') {
                    const targetNodeId = parseInt(targetId);
                    const targetNode = nodeData.find(c => c.id === targetNodeId);
                    
                    if (targetNode) {
                        if (addGraphConnection(selectedNodeId, targetNodeId)) {
                            selectedNodeId = null;
                            redrawCanvas();
                        }
                    } else {
                        alert(`Nincs csúcs ezzel az ID-val: ${targetId}`);
                    }
                }
            } else {
                alert('Először válassz ki egy csúcsot!');
            }
        }
        return;
    }
    
    // CTRL key functionality
    if (event.ctrlKey) {
        const currentBuilding = getCurrentBuildingFromImage();
        if (!currentBuilding || currentBuilding.epulet === 'KAMPUSZ') {
            alert('Nem lehet szerkeszteni a kampusztérképet!');
            return;
        }
        if (!canEditBuilding(currentBuilding.epulet)) {
            alert(`Nincs jogosultságod a(z) ${currentBuilding.epulet} épület szerkesztéséhez.`);
            return;
        }
        
        // Check if we're clicking on a node when one is selected (for deletion)
        if (selectedNodeId !== null) {
            const relevantPoints = nodeData.filter(point => 
                point.epulet === currentBuilding.epulet && point.emelet === currentBuilding.emelet
            );
            
            // Check if click is near any node (within 30 image pixels)
            const clickRadius = 30 * getImageScale();
            let clickedNode = null;
            
            for (const point of relevantPoints) {
                const x = point.x;
                const y = point.y;
                const nodeCanvasX = lastDrawnImage.drawX + (x / lastDrawnImage.img.width) * lastDrawnImage.drawWidth;
                const nodeCanvasY = lastDrawnImage.drawY + (y / lastDrawnImage.img.height) * lastDrawnImage.drawHeight;
                
                const distance = Math.sqrt(Math.pow(nodeCanvasX - canvasX, 2) + Math.pow(nodeCanvasY - canvasY, 2));
                if (distance < clickRadius) {
                    clickedNode = point;
                    break;
                }
            }
            
            if (clickedNode && clickedNode.id === selectedNodeId) {
                // Delete the selected node
                deleteNode(selectedNodeId);
                selectedNodeId = null;
                redrawCanvas();
                return;
            }
        }
        
        // Add new node when CTRL is pressed (not on a selected node)
        // Get the highest ID number and add 1
        const maxId = Math.max(...nodeData.map(c => c.id || 0), -1);
        const newId = maxId + 1;
        
        // Get selected type from selector
        const nodeTypeSelector = document.getElementById('nodeTypeSelector');
        const tipus = nodeTypeSelector.value;
        
        let teremnev = '';
        
        // Determine teremnev based on type
        if (tipus === '0') {
            // Folyosó: epulet + emelet + 'F'
            teremnev = currentBuilding.epulet + currentBuilding.emelet + 'F';
        } else if (tipus === '2') {
            // Ajtó: prompt for description
            teremnev = prompt('Bejárat neve/leírása:', currentBuilding.epulet + ' ' + currentBuilding.emelet + ' bejárat');
            if (teremnev === null) return; // User cancelled
        } else if (tipus === '1') {
            // Terem: prompt for name
            teremnev = prompt('Terem neve:', '');
            if (teremnev === null) return; // User cancelled
        }
        
        // Create new node object
        const newNode = {
            id: newId,
            epulet: currentBuilding.epulet,
            emelet: currentBuilding.emelet,
            x: imageX,
            y: imageY,
            teremnev: teremnev,
            tipus: tipus
        };
        
        // Add to nodeData array
        nodeData.push(newNode);
        
        // Redraw to show the new point
        redrawCanvas();
        
        console.log('New node added:', newNode);
    }
});

// Function to add/remove a graph connection between two nodes (toggles)
function addGraphConnection(id1, id2) {
    const node1 = nodeData.find(c => c.id === id1);
    const node2 = nodeData.find(c => c.id === id2);
    if (!node1 || !node2) {
        alert('A megadott csúcs nem létezik.');
        return false;
    }
    if (!canEditBuilding(node1.epulet) || !canEditBuilding(node2.epulet)) {
        alert('Nincs jogosultságod a kapcsolat létrehozásához (mindkét csúcshoz kell jogosultság).');
        return false;
    }

    // Initialize arrays if they don't exist
    if (!buildingGraph[id1]) {
        buildingGraph[id1] = [];
    }
    if (!buildingGraph[id2]) {
        buildingGraph[id2] = [];
    }
    
    // Check if connection already exists
    const alreadyConnected = buildingGraph[id1].includes(id2);
    
    if (alreadyConnected) {
        // Remove connection (toggle off)
        buildingGraph[id1] = buildingGraph[id1].filter(n => n !== id2);
        buildingGraph[id2] = buildingGraph[id2].filter(n => n !== id1);
        console.log(`Connection removed: ${id1} <-> ${id2}`);
    } else {
        // Add bidirectional connection
        buildingGraph[id1].push(id2);
        buildingGraph[id2].push(id1);
        console.log(`Connection added: ${id1} <-> ${id2}`);
    }

    return true;
}

// Function to delete a node
function deleteNode(nodeId) {
    const nodeIndex = nodeData.findIndex(c => c.id === nodeId);
    
    if (nodeIndex === -1) {
        console.log(`Node ${nodeId} not found`);
        return;
    }
    
    // Remove the node from nodeData
    const deletedNode = nodeData.splice(nodeIndex, 1)[0];
    
    // Remove all connections to this node
    if (buildingGraph[nodeId]) {
        delete buildingGraph[nodeId];
    }
    
    // Remove references to this node from other nodes' connections
    Object.keys(buildingGraph).forEach(id => {
        buildingGraph[id] = buildingGraph[id].filter(n => n !== nodeId);
    });
    
    console.log(`Node ${nodeId} (${deletedNode.teremnev}) deleted`);
}

// Draw selection indicator for selected node
function drawSelectionIndicator() {
    if (!selectedNodeId || !lastDrawnImage.img || !currentImageFilename) return;

    const scale = getImageScale();
    const selectedNode = nodeData.find(c => c.id === selectedNodeId);
    if (!selectedNode) return;

    const x = selectedNode.x;
    const y = selectedNode.y;

    // Convert to canvas coordinates
    const canvasX = lastDrawnImage.drawX + (x / lastDrawnImage.img.width) * lastDrawnImage.drawWidth;
    const canvasY = lastDrawnImage.drawY + (y / lastDrawnImage.img.height) * lastDrawnImage.drawHeight;

    // Draw orange selection circle
    const radius = 40 * scale;
    ctx.strokeStyle = 'orange';
    ctx.lineWidth = 6 * scale;
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, radius, 0, Math.PI * 2);
    ctx.stroke();
}

// Override redrawCanvas to include dev UI features
const originalRedrawCanvas = redrawCanvas;
window.redrawCanvas = async function() {
    await originalRedrawCanvas();
    
    // Draw graph connections first (beneath nodes)
    drawGraphConnections();
    
    // Draw nodes for current building layer
    drawNodes();
    
    // Draw selection indicator on top
    drawSelectionIndicator();
};

// Building Selector Modal functionality
const buildingModal = document.getElementById('buildingModal');
const buildingSelectorBtn = document.getElementById('buildingSelector');
const buildingList = document.getElementById('buildingList');
const buildingSearch = document.getElementById('buildingSearch');
const floorModal = document.getElementById('floorModal');
const floorSelectorBtn = document.getElementById('floorSelector');
const floorList = document.getElementById('floorList');
const floorSearch = document.getElementById('floorSearch');
const floorQuickButtons = document.getElementById('floorQuickButtons');

function isCampusBuilding(building) {
    return !!building && building.epulet === 'KAMPUSZ';
}

function getBuildingFloors(epulet) {
    return epuletekData
        .filter(b => b.epulet === epulet)
        .slice();
}

function sortFloorsById(floors) {
    return floors.sort((a, b) => {
        const ida = Number(a.id);
        const idb = Number(b.id);
        if (Number.isFinite(ida) && Number.isFinite(idb)) return ida - idb;
        return String(a.id).localeCompare(String(b.id), 'hu');
    });
}

function chooseDefaultFloorForBuilding(epulet) {
    const floors = getBuildingFloors(epulet);
    if (floors.length === 0) return null;

    const f = floors.find(b => b.emelet === 'F');
    if (f) return f;

    const zero = floors.find(b => b.emelet === '0');
    if (zero) return zero;

    return floors.reduce((min, cur) => (Number(cur.id) < Number(min.id) ? cur : min), floors[0]);
}

function setCurrentMap(buildingEntry) {
    if (!buildingEntry) return;
    exitNavigationMode();
    selectedNodeId = null;
    setImage(buildingEntry.filename);
    redrawCanvas();
}

function updateFloorControls() {
    if (!floorSelectorBtn || !floorQuickButtons) return;

    const currentBuilding = getCurrentBuildingFromImage();
    if (!currentBuilding || isCampusBuilding(currentBuilding)) {
        floorSelectorBtn.disabled = true;
        floorSelectorBtn.className = 'disabled';
        floorQuickButtons.innerHTML = '';
        return;
    }

    floorSelectorBtn.disabled = false;
    floorSelectorBtn.className = 'primary btn-success';

    const floors = sortFloorsById(getBuildingFloors(currentBuilding.epulet));
    floorQuickButtons.innerHTML = '';

    floors.forEach(floor => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'floor-quick-btn';
        btn.textContent = floor.emelet;
        if (floor.filename === currentImageFilename) {
            btn.classList.add('current');
        }
        btn.addEventListener('click', () => setCurrentMap(floor));
        floorQuickButtons.appendChild(btn);
    });
}

// Open building selector modal
buildingSelectorBtn.addEventListener('click', () => {
    buildingList.innerHTML = '';
    if (buildingSearch) buildingSearch.value = '';
    const currentBuilding = getCurrentBuildingFromImage();

    const byEpulet = new Map();
    epuletekData.forEach(b => {
        if (b.epulet === 'KAMPUSZ') return;
        if (!byEpulet.has(b.epulet)) byEpulet.set(b.epulet, []);
        byEpulet.get(b.epulet).push(b);
    });

    const buildings = Array.from(byEpulet.entries())
        .map(([epulet, floors]) => ({ epulet, floors }))
        .sort((a, b) => a.epulet.localeCompare(b.epulet, 'hu'));

    buildings.forEach(({ epulet, floors }) => {
        const li = document.createElement('li');
        li.className = 'building-item';
        li.setAttribute('data-epulet', epulet);
        if (currentBuilding && currentBuilding.epulet === epulet) {
            li.classList.add('current');
        }

        const nameDiv = document.createElement('div');
        nameDiv.className = 'building-name';
        nameDiv.textContent = epulet;

        const fileDiv = document.createElement('div');
        fileDiv.className = 'building-file';
        const floorNames = sortFloorsById(floors.slice()).map(f => f.emelet);
        const preview = floorNames.length > 8 ? `${floorNames.slice(0, 8).join(', ')}, …` : floorNames.join(', ');
        fileDiv.textContent = `Szintek: ${preview}`;

        li.appendChild(nameDiv);
        li.appendChild(fileDiv);

        li.addEventListener('click', () => {
            const defaultFloor = chooseDefaultFloorForBuilding(epulet);
            setCurrentMap(defaultFloor);
            buildingModal.style.display = 'none';
        });

        buildingList.appendChild(li);
    });

    buildingModal.style.display = 'block';
    updateTopMatch(buildingList);
    if (buildingSearch) buildingSearch.focus();
});

// Open floor selector modal
if (floorSelectorBtn) {
    floorSelectorBtn.addEventListener('click', () => {
        if (floorSelectorBtn.disabled) return;

        const currentBuilding = getCurrentBuildingFromImage();
        if (!currentBuilding || isCampusBuilding(currentBuilding)) return;

        floorList.innerHTML = '';
        if (floorSearch) floorSearch.value = '';
        const floors = sortFloorsById(getBuildingFloors(currentBuilding.epulet));

        floors.forEach(floor => {
            const li = document.createElement('li');
            li.className = 'building-item';
            li.setAttribute('data-filename', floor.filename);
            if (floor.filename === currentImageFilename) {
                li.classList.add('current');
            }

            const nameDiv = document.createElement('div');
            nameDiv.className = 'building-name';
            nameDiv.textContent = floor.emelet;

            const fileDiv = document.createElement('div');
            fileDiv.className = 'building-file';
            fileDiv.textContent = floor.filename;

            li.appendChild(nameDiv);
            li.appendChild(fileDiv);

            li.addEventListener('click', () => {
                setCurrentMap(floor);
                floorModal.style.display = 'none';
            });

            floorList.appendChild(li);
        });

        floorModal.style.display = 'block';
        updateTopMatch(floorList);
        if (floorSearch) floorSearch.focus();
    });
}

// Keep floor UI in sync with image changes
if (typeof window.setImage === 'function') {
    const originalSetImage = window.setImage;
    window.setImage = function(filename) {
        originalSetImage(filename);
        updateFloorControls();
    };
}

function applyModalSearchFilter(listEl, query, getText) {
    const normalizedQuery = (query || '').trim().toLowerCase();
    Array.from(listEl.children).forEach(li => {
        const haystack = (getText(li) || '').toLowerCase();
        li.style.display = normalizedQuery === '' || haystack.includes(normalizedQuery) ? '' : 'none';
    });
    updateTopMatch(listEl);
}

function updateTopMatch(listEl) {
    Array.from(listEl.children).forEach(li => li.classList.remove('top-match'));
    const firstVisible = Array.from(listEl.children).find(li => li.style.display !== 'none');
    if (firstVisible) firstVisible.classList.add('top-match');
}

if (buildingSearch && buildingList) {
    buildingSearch.addEventListener('input', () => {
        applyModalSearchFilter(buildingList, buildingSearch.value, (li) => li.getAttribute('data-epulet') || '');
    });
    buildingSearch.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const firstVisible = Array.from(buildingList.children).find(li => li.style.display !== 'none');
        if (firstVisible) firstVisible.click();
    });
}

if (floorSearch && floorList) {
    floorSearch.addEventListener('input', () => {
        applyModalSearchFilter(floorList, floorSearch.value, (li) => li.querySelector('.building-name')?.textContent || '');
    });
    floorSearch.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const firstVisible = Array.from(floorList.children).find(li => li.style.display !== 'none');
        if (firstVisible) firstVisible.click();
    });
}

// Export CSV Modal functionality
const exportModal = document.getElementById('exportModal');
const exportNodesBtn = document.getElementById('exportNodes');
const exportTextarea = document.getElementById('exportTextarea');
const copyButton = document.getElementById('copyButton');

// Function to convert csucsokData to CSV
function generateCsucsokCSV() {
    // CSV headers
    const headers = ['id', 'epulet', 'emelet', 'x', 'y', 'teremnev', 'tipus'];
    let csv = headers.join(',') + '\n';
    
    // Add each row
    nodeData.forEach(node => {
        const row = headers.map(header => {
            const value = node[header].toString() || '';
            // Escape commas and quotes in CSV values
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                return '"' + value.replace(/"/g, '""') + '"';
            }
            return value;
        });
        csv += row.join(',') + '\n';
    });
    
    return csv;
}

// Open export modal
exportNodesBtn.addEventListener('click', () => {
    const csvData = generateCsucsokCSV();
    exportTextarea.value = csvData;
    exportModal.style.display = 'block';
    console.log(`Exported ${nodeData.length} nodes to CSV`);
});

// Copy to clipboard functionality
copyButton.addEventListener('click', () => {
    exportTextarea.select();
    document.execCommand('copy');
    
    // Show feedback
    const originalText = copyButton.textContent;
    copyButton.textContent = '✓ Másolva!';
    copyButton.style.backgroundColor = '#218838';
    
    setTimeout(() => {
        copyButton.textContent = originalText;
        copyButton.style.backgroundColor = '#28a745';
    }, 2000);
});

// Save to Database functionality
const saveToDatabase = document.getElementById('saveToDatabase');

saveToDatabase.addEventListener('click', async () => {
    // Check auth state
    if (!authState.authenticated) {
        showSaveResultPopup('Bejelentkezés szükséges', 'A mentéshez be kell jelentkezned.', 'error');
        return;
    }

    if (!authState.isAdmin && authState.buildingPermissions.length === 0) {
        showSaveResultPopup('Nincs jogosultság', 'Nincs egyetlen épülethez sem szerkesztési jogosultságod.', 'error');
        return;
    }

    // Calculate diffs
    const nodesDiff = calculateNodesDiff();
    const edgesDiff = calculateEdgesDiff();

    // Filter diffs by permissions
    const filtered = filterDiffsByPermissions(nodesDiff, edgesDiff, authState.buildingPermissions);

    // Check if there are any changes
    const totalChanges =
        filtered.nodes.added.length +
        filtered.nodes.updated.length +
        filtered.nodes.deleted.length +
        filtered.edges.added.length +
        filtered.edges.deleted.length;

    if (totalChanges === 0) {
        showSaveResultPopup('Nincs módosítás', 'Nem történt változás, amit menteni kellene.', 'error');
        return;
    }

    // Show confirmation with change summary
    let confirmMessage = 'Biztosan menteni szeretnéd a következő módosításokat?\n\n';
    confirmMessage += `Csúcsok: +${filtered.nodes.added.length} ~${filtered.nodes.updated.length} -${filtered.nodes.deleted.length}\n`;
    confirmMessage += `Élek: +${filtered.edges.added.length} -${filtered.edges.deleted.length}`;

    if (!confirm(confirmMessage)) {
        return;
    }

    // Disable button during save
    saveToDatabase.disabled = true;
    saveToDatabase.textContent = 'Mentés...';
    saveToDatabase.style.backgroundColor = '#6c757d';

    try {
        // Prepare changes object
        const changes = {
            nodes: filtered.nodes,
            edges: filtered.edges
        };

        console.log('Applying changes to database...', changes);
        const result = await API.applyChanges(changes);

        if (!result.success) {
            throw new Error(result.error);
        }

        // Update snapshots after successful save
        updateSnapshots();

        // Show detailed result
        const stats = result.stats || {};
        let message = `Sikeresen mentve!\n\n`;
        message += `Csúcsok hozzáadva: ${stats.nodes_added || 0}\n`;
        message += `Csúcsok frissítve: ${stats.nodes_updated || 0}\n`;
        message += `Csúcsok törölve: ${stats.nodes_deleted || 0}\n`;
        message += `Élek hozzáadva: ${stats.edges_added || 0}\n`;
        message += `Élek törölve: ${stats.edges_deleted || 0}`;

        showSaveResultPopup('Mentés sikeres', message, 'success');

        console.log('Changes applied successfully:', stats);

        // Reset button
        saveToDatabase.textContent = 'Módosítások mentése';
        saveToDatabase.style.backgroundColor = '#dc3545';
        saveToDatabase.disabled = false;
        updateSaveButtonState();

    } catch (error) {
        console.error('Error saving to database:', error);
        showSaveResultPopup('Hiba', 'Mentés sikertelen: ' + error.message, 'error');

        saveToDatabase.textContent = 'Módosítások mentése';
        saveToDatabase.style.backgroundColor = '#dc3545';
        saveToDatabase.disabled = false;
        updateSaveButtonState();
    }
});

// Export Elek.txt functionality
const exportEdgesBtn = document.getElementById('exportEdges');

// Function to generate elek.txt format
function generateElekTxt() {
    let txt = '';
    
    // Get all unique node IDs and sort them
    const allIds = Array.from(new Set(nodeData.map(c => c.id))).sort((a, b) => a - b);
    
    // For each node ID, output the ID followed by its neighbors
    allIds.forEach(id => {
        const neighbors = buildingGraph[id] || [];
        txt += id;
        if (neighbors.length > 0) {
            txt += ' ' + neighbors.join(' ');
        }
        txt += '\n';
    });
    
    return txt;
}

// Open export modal with elek.txt content
exportEdgesBtn.addEventListener('click', () => {
    const edgeData = generateElekTxt();
    exportTextarea.value = edgeData;
    exportModal.style.display = 'block';
    
    // Count connections
    const totalConnections = Object.values(buildingGraph).reduce((sum, neighbors) => sum + neighbors.length, 0) / 2;
    console.log(`Exported elek.txt with ${Object.keys(buildingGraph).length} nodes and ${totalConnections} connections`);
});

// Close modals when clicking X
document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
        const modalId = closeBtn.getAttribute('data-modal');
        if (modalId) {
            document.getElementById(modalId).style.display = 'none';
        }
    });
});

// Close modals when clicking outside of them
const loginModal = document.getElementById('loginModal');
const saveResultModal = document.getElementById('saveResultModal');

	window.addEventListener('click', (event) => {
	    if (event.target === buildingModal) {
	        buildingModal.style.display = 'none';
	    }
	    if (floorModal && event.target === floorModal) {
	        floorModal.style.display = 'none';
	    }
	    if (event.target === exportModal) {
	        exportModal.style.display = 'none';
	    }
	    if (doorModal && event.target === doorModal) {
	        doorModal.style.display = 'none';
    }
    if (event.target === loginModal) {
        loginModal.style.display = 'none';
    }
    if (event.target === saveResultModal) {
        saveResultModal.style.display = 'none';
    }
});

// Close modals when pressing Escape
	window.addEventListener('keydown', (event) => {
	    if (event.key === 'Escape') {
	        if (buildingModal) buildingModal.style.display = 'none';
	        if (floorModal) floorModal.style.display = 'none';
	        if (exportModal) exportModal.style.display = 'none';
	        if (doorModal) doorModal.style.display = 'none';
	        if (loginModal) loginModal.style.display = 'none';
	        if (saveResultModal) saveResultModal.style.display = 'none';
	    }
	});

// Login button handler
document.getElementById('loginButton').addEventListener('click', () => {
    loginModal.style.display = 'block';
    document.getElementById('loginUsername').focus();
});

// Logout button handler
document.getElementById('logoutButton').addEventListener('click', async () => {
    try {
        await API.logout();
        updateAuthState({ authenticated: false, user: null, building_permissions: [] });
    } catch (error) {
        console.error('Logout failed:', error);
    }
});

// Login form handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    try {
        const result = await API.login(username, password);

        if (result.success) {
            updateAuthState({
                authenticated: true,
                user: result.user,
                building_permissions: result.user.building_permissions
            });
            loginModal.style.display = 'none';
            document.getElementById('loginForm').reset();
            errorDiv.style.display = 'none';
        } else {
            errorDiv.textContent = result.error || 'Bejelentkezés sikertelen';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Hálózati hiba történt';
        errorDiv.style.display = 'block';
    }
});

// Initialize application with proper sequencing
initializeApplication();

console.log('Dev UI loaded - Press ALT+Click to get coordinates');
