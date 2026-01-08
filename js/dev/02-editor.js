// Canvas click event listener - show coordinates when ALT is pressed, add node when CTRL is pressed
canvas.addEventListener('click', (event) => {
    if (!lastDrawnImage.img) return;
    
    // Get canvas position relative to viewport
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    const imgPt = canvasToImagePoint(canvasX, canvasY);
    if (!imgPt) return;

    const imageX = imgPt.x;
    const imageY = imgPt.y;
    
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
            alert(`Nincs jogosultságod a(z) ${currentFloor.building} épület szerkesztéséhez.`);
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
            const nodePt = imageToCanvasPoint(x, y);
            if (!nodePt) continue;

            const distance = Math.sqrt(Math.pow(nodePt.x - canvasX, 2) + Math.pow(nodePt.y - canvasY, 2));
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
                requestRedrawCanvas();
            } else if (selectedNodeId === clickedId) {
                // Unselect the node
                selectedNodeId = null;
                console.log(`Node ${clickedId} unselected`);
                requestRedrawCanvas();
            } else {
                // Connect the two nodes
                if (addGraphConnection(selectedNodeId, clickedId)) {
                    selectedNodeId = null;
                    requestRedrawCanvas();
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
                            requestRedrawCanvas();
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
        if (!currentFloor?.building || isCampusFloor(currentFloor)) {
            alert('Nem lehet szerkeszteni a kampusztérképet!');
            return;
        }
        if (!canEditBuilding(currentFloor.building)) {
            alert(`Nincs jogosultságod a(z) ${currentFloor.building} épület szerkesztéséhez.`);
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
                const nodePt = imageToCanvasPoint(x, y);
                if (!nodePt) continue;
                
                const distance = Math.sqrt(Math.pow(nodePt.x - canvasX, 2) + Math.pow(nodePt.y - canvasY, 2));
                if (distance < clickRadius) {
                    clickedNode = point;
                    break;
                }
            }
            
            if (clickedNode && clickedNode.id === selectedNodeId) {
                // Delete the selected node
                deleteNode(selectedNodeId);
                selectedNodeId = null;
                requestRedrawCanvas();
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
            // Folyosó: building + floor + 'F'
            room_name = currentFloor.building + currentFloor.floor + 'F';
        } else if (node_type === '2') {
            // Ajtó: prompt for description
            room_name = prompt('Bejárat neve/leírása:', currentFloor.building + ' ' + currentFloor.floor + ' bejárat');
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
        requestRedrawCanvas();
        
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
    if (!canEditBuilding(node1.building) || !canEditBuilding(node2.building)) {
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

    const pt = imageToCanvasPoint(x, y);
    if (!pt) return;

    // Draw orange selection circle
    const radius = 40 * scale;
    ctx.strokeStyle = 'orange';
    ctx.lineWidth = 6 * scale;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
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

