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
        alert('Hiba tĂ¶rtĂ©nt az alkalmazĂˇs betĂ¶ltĂ©se sorĂˇn. KĂ©rjĂĽk, frissĂ­tse az oldalt.');
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

function canEditBuilding(building) {
    if (!authState.authenticated) return false;
    if (authState.isAdmin) return true;
    return authState.buildingPermissions.includes(building);
}

function isCampusFloor(floor) {
    return !!floor && floor.building === 'KAMPUSZ';
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
            statusText += ' (nincs jogosultsĂˇg)';
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
            ? 'Nincs jogosultsĂˇgod egyetlen Ă©pĂĽlethez sem'
            : 'BejelentkezĂ©s szĂĽksĂ©ges a mentĂ©shez';
    } else {
        saveButton.classList.remove('no-permissions');
        saveButton.disabled = false;
        if (authState.isAdmin) {
            saveButton.title = 'MentĂ©s (admin)';
            return;
        }
        saveButton.title = `MentĂ©s (jogosultsĂˇg: ${authState.buildingPermissions.join(', ')})`;
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
    if (!lastDrawnImage.img || !currentFloor?.filename) return;

    const scale = getImageScale();

    if (!currentFloor?.building || isCampusFloor(currentFloor)) return;

    // Filter points that match current building and floor
    const relevantPoints = nodeData.filter(point =>
        point.building === currentFloor.building && point.floor === currentFloor.floor
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
            if (neighbor && neighbor.building === point.building && 
                neighbor.floor === point.floor && neighbor.id > pointId) {

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
    if (!lastDrawnImage.img || !currentFloor?.filename) return;

    const scale = getImageScale();

    if (!currentFloor?.building || isCampusFloor(currentFloor)) return;

    // Filter points that match current building and floor
    const relevantPoints = nodeData.filter(point =>
        point.building === currentFloor.building && point.floor === currentFloor.floor
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

        // For type 1, show "ID-room_name", otherwise just ID
        let displayText = point.id;
        if (point.node_type === '1' && point.room_name) {
            ctx.fillStyle = 'lightblue';
            displayText = `${point.id}-${point.room_name}`;
        } else if (point.node_type === '2') {
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
        if (!currentFloor?.building || isCampusFloor(currentFloor)) return;
        if (!canEditBuilding(currentFloor.building)) {
            alert(`Nincs jogosultsĂˇgod a(z) ${currentFloor.building} Ă©pĂĽlet szerkesztĂ©sĂ©hez.`);
            return;
        }

        let clickedNode = null;

        const relevantPoints = nodeData.filter(point =>
            point.building === currentFloor.building && point.floor === currentFloor.floor
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
                const targetId = prompt('CsĂşcs ID a csatlakozĂˇshoz:', '');
                if (targetId !== null && targetId.trim() !== '') {
                    const targetNodeId = parseInt(targetId);
                    const targetNode = nodeData.find(c => c.id === targetNodeId);
                    
                    if (targetNode) {
                        if (addGraphConnection(selectedNodeId, targetNodeId)) {
                            selectedNodeId = null;
                            redrawCanvas();
                        }
                    } else {
                        alert(`Nincs csĂşcs ezzel az ID-val: ${targetId}`);
                    }
                }
            } else {
                alert('ElĹ‘szĂ¶r vĂˇlassz ki egy csĂşcsot!');
            }
        }
        return;
    }
    
    // CTRL key functionality
    if (event.ctrlKey) {
        if (!currentFloor?.building || isCampusFloor(currentFloor)) {
            alert('Nem lehet szerkeszteni a kampusztĂ©rkĂ©pet!');
            return;
        }
        if (!canEditBuilding(currentFloor.building)) {
            alert(`Nincs jogosultsĂˇgod a(z) ${currentFloor.building} Ă©pĂĽlet szerkesztĂ©sĂ©hez.`);
            return;
        }
        
        // Check if we're clicking on a node when one is selected (for deletion)
        if (selectedNodeId !== null) {
            const relevantPoints = nodeData.filter(point => 
                point.building === currentFloor.building && point.floor === currentFloor.floor
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
        const node_type = nodeTypeSelector.value;
        
        let room_name = '';
        
        // Determine room_name based on type
        if (node_type === '0') {
            // FolyosĂł: building + floor + 'F'
            room_name = currentFloor.building + currentFloor.floor + 'F';
        } else if (node_type === '2') {
            // AjtĂł: prompt for description
            room_name = prompt('BejĂˇrat neve/leĂ­rĂˇsa:', currentFloor.building + ' ' + currentFloor.floor + ' bejĂˇrat');
            if (room_name === null) return; // User cancelled
        } else if (node_type === '1') {
            // Terem: prompt for name
            room_name = prompt('Terem neve:', '');
            if (room_name === null) return; // User cancelled
        }
        
        // Create new node object
        const newNode = {
            id: newId,
            building: currentFloor.building,
            floor: currentFloor.floor,
            x: imageX,
            y: imageY,
            room_name: room_name,
            node_type: node_type
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
        alert('A megadott csĂşcs nem lĂ©tezik.');
        return false;
    }
    if (!canEditBuilding(node1.building) || !canEditBuilding(node2.building)) {
        alert('Nincs jogosultsĂˇgod a kapcsolat lĂ©trehozĂˇsĂˇhoz (mindkĂ©t csĂşcshoz kell jogosultsĂˇg).');
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
    
    console.log(`Node ${nodeId} (${deletedNode.room_name}) deleted`);
}

// Draw selection indicator for selected node
function drawSelectionIndicator() {
    if (!selectedNodeId || !lastDrawnImage.img || !currentFloor?.filename) return;

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

// Dev-only: clear selection when changing floors (navigation + selector behavior is handled by app.js)
const previousOnCurrentFloorChanged = window.onCurrentFloorChanged;
window.onCurrentFloorChanged = function(floor) {
    selectedNodeId = null;
    if (typeof previousOnCurrentFloorChanged === 'function') {
        previousOnCurrentFloorChanged(floor);
    }
};

// Export CSV Modal functionality
const exportModal = document.getElementById('exportModal');
const exportNodesBtn = document.getElementById('exportNodes');
const exportTextarea = document.getElementById('exportTextarea');
const copyButton = document.getElementById('copyButton');

// Function to convert csucsokData to CSV
function generateCsucsokCSV() {
    // CSV headers
    const headers = ['id', 'building', 'floor', 'x', 'y', 'room_name', 'node_type'];
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
    copyButton.textContent = 'âś“ MĂˇsolva!';
    copyButton.style.backgroundColor = '#218838';
    
    setTimeout(() => {
        copyButton.textContent = originalText;
        copyButton.style.backgroundColor = '#28a745';
    }, 2000);
});

// Save to Database functionality
const saveToDatabase = document.getElementById('saveToDatabase');
const saveConfirmModal = document.getElementById('saveConfirmModal');
const saveConfirmMessage = document.getElementById('saveConfirmMessage');
const saveConfirmCancel = document.getElementById('saveConfirmCancel');
const saveConfirmOk = document.getElementById('saveConfirmOk');

let saveConfirmResolve = null;

function closeSaveConfirmModal(result) {
    if (saveConfirmModal) saveConfirmModal.style.display = 'none';
    if (typeof saveConfirmResolve === 'function') {
        const resolve = saveConfirmResolve;
        saveConfirmResolve = null;
        resolve(!!result);
    }
}

function confirmSaveChanges(message) {
    if (!saveConfirmModal || !saveConfirmMessage || !saveConfirmCancel || !saveConfirmOk) {
        return Promise.resolve(confirm(message));
    }

    saveConfirmMessage.textContent = message;
    saveConfirmModal.style.display = 'block';

    return new Promise((resolve) => {
        saveConfirmResolve = resolve;
        setTimeout(() => saveConfirmOk.focus(), 0);
    });
}

if (saveConfirmCancel) {
    saveConfirmCancel.addEventListener('click', () => closeSaveConfirmModal(false));
}
if (saveConfirmOk) {
    saveConfirmOk.addEventListener('click', () => closeSaveConfirmModal(true));
}
if (saveConfirmModal) {
    const closeBtn = saveConfirmModal.querySelector('.close');
    if (closeBtn) closeBtn.addEventListener('click', () => closeSaveConfirmModal(false));
    window.addEventListener('click', (event) => {
        if (event.target === saveConfirmModal) closeSaveConfirmModal(false);
    });
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && saveConfirmModal.style.display === 'block') {
            closeSaveConfirmModal(false);
        }
    });
}

saveToDatabase.addEventListener('click', async () => {
    // Check auth state
    if (!authState.authenticated) {
        showSaveResultPopup('BejelentkezĂ©s szĂĽksĂ©ges', 'A mentĂ©shez be kell jelentkezned.', 'error');
        return;
    }

    if (!authState.isAdmin && authState.buildingPermissions.length === 0) {
        showSaveResultPopup('Nincs jogosultsĂˇg', 'Nincs egyetlen Ă©pĂĽlethez sem szerkesztĂ©si jogosultsĂˇgod.', 'error');
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
        showSaveResultPopup('Nincs mĂłdosĂ­tĂˇs', 'Nem tĂ¶rtĂ©nt vĂˇltozĂˇs, amit menteni kellene.', 'error');
        return;
    }

    // Show confirmation with change summary
    let confirmMessage = 'Biztosan menteni szeretnĂ©d a kĂ¶vetkezĹ‘ mĂłdosĂ­tĂˇsokat?\n\n';
    confirmMessage += `CsĂşcsok hozzĂˇadva: ${filtered.nodes.added.length}\n`;
    confirmMessage += `CsĂşcsok frissĂ­tve: ${filtered.nodes.updated.length}\n`;
    confirmMessage += `CsĂşcsok tĂ¶rĂ¶lve: ${filtered.nodes.deleted.length}\n`;
    confirmMessage += `Ă‰lek hozzĂˇadva: ${filtered.edges.added.length}\n`;
    confirmMessage += `Ă‰lek tĂ¶rĂ¶lve: ${filtered.edges.deleted.length}`;
    const shouldSave = await confirmSaveChanges(confirmMessage);
    if (!shouldSave) return;

    // Disable button during save
    saveToDatabase.disabled = true;
    saveToDatabase.textContent = 'MentĂ©s...';
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
        message += `CsĂşcsok hozzĂˇadva: ${stats.nodes_added || 0}\n`;
        message += `CsĂşcsok frissĂ­tve: ${stats.nodes_updated || 0}\n`;
        message += `CsĂşcsok tĂ¶rĂ¶lve: ${stats.nodes_deleted || 0}\n`;
        message += `Ă‰lek hozzĂˇadva: ${stats.edges_added || 0}\n`;
        message += `Ă‰lek tĂ¶rĂ¶lve: ${stats.edges_deleted || 0}`;

        showSaveResultPopup('MentĂ©s sikeres', message, 'success');

        console.log('Changes applied successfully:', stats);

        // Reset button
        saveToDatabase.textContent = 'MĂłdosĂ­tĂˇsok mentĂ©se';
        saveToDatabase.style.backgroundColor = '#dc3545';
        saveToDatabase.disabled = false;
        updateSaveButtonState();

    } catch (error) {
        console.error('Error saving to database:', error);
        showSaveResultPopup('Hiba', 'MentĂ©s sikertelen: ' + error.message, 'error');

        saveToDatabase.textContent = 'MĂłdosĂ­tĂˇsok mentĂ©se';
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
            errorDiv.textContent = result.error || 'BejelentkezĂ©s sikertelen';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'HĂˇlĂłzati hiba tĂ¶rtĂ©nt';
        errorDiv.style.display = 'block';
    }
});

// Initialize application with proper sequencing
initializeApplication();

console.log('Dev UI loaded - Press ALT+Click to get coordinates');
