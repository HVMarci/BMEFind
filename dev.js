// Development UI features
// This file contains development tools for debugging and mapping coordinate placement

// Track selected node for graph editing
let selectedNodeId = null;

// Draw graph connections (green lines between connected nodes)
function drawGraphConnections() {
    if (!lastDrawnImage.img || !currentImageFilename) return;
    
    // Find the current building and floor from the current image
    const currentBuilding = epuletekData.find(b => b.filename === currentImageFilename);
    if (!currentBuilding || currentBuilding.epulet === 'KAMPUSZ') return;
    
    // Filter points that match current building and floor
    const relevantPoints = nodeData.filter(point => 
        point.epulet === currentBuilding.epulet && point.emelet === currentBuilding.emelet
    );
    
    // Draw connections between nodes
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = 2 * zoomLevel;
    
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
        const radius = 15 * zoomLevel;
        ctx.fillStyle = 'green';
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw white border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2 * zoomLevel;
        ctx.stroke();
        
        // Draw the ID text in white
        ctx.fillStyle = 'white';
        ctx.font = `bold ${12 * zoomLevel}px Arial`;
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
        const currentBuilding = epuletekData.find(b => b.filename === currentImageFilename);
        let clickedNode = null;
        
        if (currentBuilding && currentBuilding.epulet !== 'KAMPUSZ') {
            const relevantPoints = nodeData.filter(point => 
                point.epulet === currentBuilding.epulet && point.emelet === currentBuilding.emelet
            );
            
            // Check if click is near any node (within 20 pixels)
            const clickRadius = 20 * zoomLevel;
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
                addGraphConnection(selectedNodeId, clickedId);
                selectedNodeId = null;
                redrawCanvas();
            }
        } else {
            // Clicked on empty space - prompt for ID
            if (selectedNodeId !== null) {
                const targetId = prompt('Csúcs ID a csatlakozáshoz:', '');
                if (targetId !== null && targetId.trim() !== '') {
                    const targetNodeId = parseInt(targetId);
                    const targetNode = nodeData.find(c => c.id === targetNodeId);
                    
                    if (targetNode) {
                        addGraphConnection(selectedNodeId, targetNodeId);
                        selectedNodeId = null;
                        redrawCanvas();
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
        const currentBuilding = epuletekData.find(b => b.filename === currentImageFilename);
        if (!currentBuilding || currentBuilding.epulet === 'KAMPUSZ') {
            alert('Nem lehet csúcsot hozzáadni/törölni a campus térképhez!');
            return;
        }
        
        // Check if we're clicking on a node when one is selected (for deletion)
        if (selectedNodeId !== null) {
            const relevantPoints = nodeData.filter(point => 
                point.epulet === currentBuilding.epulet && point.emelet === currentBuilding.emelet
            );
            
            // Check if click is near any node (within 20 pixels)
            const clickRadius = 20 * zoomLevel;
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
    
    const selectedNode = nodeData.find(c => c.id === selectedNodeId);
    if (!selectedNode) return;
    
    const x = selectedNode.x;
    const y = selectedNode.y;
    
    // Convert to canvas coordinates
    const canvasX = lastDrawnImage.drawX + (x / lastDrawnImage.img.width) * lastDrawnImage.drawWidth;
    const canvasY = lastDrawnImage.drawY + (y / lastDrawnImage.img.height) * lastDrawnImage.drawHeight;
    
    // Draw orange selection circle
    const radius = 20 * zoomLevel;
    ctx.strokeStyle = 'orange';
    ctx.lineWidth = 3 * zoomLevel;
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

// Open building selector modal
buildingSelectorBtn.addEventListener('click', () => {
    // Populate building list
    buildingList.innerHTML = '';
    
    epuletekData.forEach((building, index) => {
        const li = document.createElement('li');
        li.className = 'building-item';
        li.setAttribute('data-filename', building.filename);
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'building-name';
        nameDiv.textContent = `${building.epulet} - ${building.emelet}`;
        
        const fileDiv = document.createElement('div');
        fileDiv.className = 'building-file';
        fileDiv.textContent = building.filename;
        
        li.appendChild(nameDiv);
        li.appendChild(fileDiv);
        
        // Add click handler to load the map
        li.addEventListener('click', () => {
            exitNavigationMode();

            setImage(building.filename);
            redrawCanvas();
            buildingModal.style.display = 'none';
            console.log(`Loaded: ${building.epulet} - ${building.emelet} (${building.filename})`);
        });
        
        buildingList.appendChild(li);
    });
    
    buildingModal.style.display = 'block';
});

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
    if (!confirm('Are you sure you want to save all nodes and edges to the database? This will replace all existing data.')) {
        return;
    }
    
    // Disable button during save
    saveToDatabase.disabled = true;
    saveToDatabase.textContent = '💾 Saving...';
    saveToDatabase.style.backgroundColor = '#6c757d';
    
    try {
        // Prepare nodes data
        const nodes = nodeData.map(node => ({
            id: node.id,
            epulet: node.epulet,
            emelet: node.emelet,
            x: node.x,
            y: node.y,
            teremnev: node.teremnev || '',
            tipus: node.tipus
        }));
        
        // Prepare edges data
        const edges = [];
        const processedEdges = new Set();
        
        Object.keys(buildingGraph).forEach(fromId => {
            const neighbors = buildingGraph[fromId] || [];
            neighbors.forEach(toId => {
                // Create unique edge identifier (sorted to avoid duplicates)
                const edgeKey = [fromId, toId].sort((a, b) => a - b).join('-');
                
                if (!processedEdges.has(edgeKey)) {
                    edges.push({
                        node_from: fromId,
                        node_to: toId
                    });
                    processedEdges.add(edgeKey);
                }
            });
        });
        
        // Save nodes
        console.log('Saving nodes to database...', nodes);
        const nodesResult = await API.saveNodes(nodes);
        
        if (nodesResult.error) {
            throw new Error(nodesResult.error);
        }
        
        // Save edges
        console.log('Saving edges to database...', edges);
        const edgesResult = await API.saveEdges(edges);
        
        if (edgesResult.error) {
            throw new Error(edgesResult.error);
        }
        
        // Show success
        saveToDatabase.textContent = '✓ Saved!';
        saveToDatabase.style.backgroundColor = '#28a745';
        
        console.log(`Successfully saved ${nodes.length} nodes and ${edges.length} edges to database`);
        alert(`Successfully saved ${nodes.length} nodes and ${edges.length} edges to database!`);
        
        setTimeout(() => {
            saveToDatabase.textContent = '💾 Save to Database';
            saveToDatabase.style.backgroundColor = '#dc3545';
            saveToDatabase.disabled = false;
        }, 2000);
        
    } catch (error) {
        console.error('Error saving to database:', error);
        alert('Error saving to database: ' + error.message);
        
        saveToDatabase.textContent = '❌ Error';
        saveToDatabase.style.backgroundColor = '#dc3545';
        
        setTimeout(() => {
            saveToDatabase.textContent = '💾 Save to Database';
            saveToDatabase.disabled = false;
        }, 2000);
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
window.addEventListener('click', (event) => {
    if (event.target === buildingModal) {
        buildingModal.style.display = 'none';
    }
    if (event.target === exportModal) {
        exportModal.style.display = 'none';
    }
});

console.log('Dev UI loaded - Press ALT+Click to get coordinates');
