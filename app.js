const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const SIDEBAR_WIDTH = 250;

canvas.width = window.innerWidth - SIDEBAR_WIDTH;
canvas.height = window.innerHeight;

const imageCache = new Map();
let currentImageFilename = null;
let lastDrawnImage = {
    img: null,
    drawX: 0,
    drawY: 0,
    drawWidth: 0,
    drawHeight: 0
};

// Zoom and pan state
let zoomLevel = 1;
let offsetX = 0;
let offsetY = 0;
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
const MIN_ZOOM = 1;
const MAX_ZOOM = 5;
const ZOOM_SPEED = 0.1;
// Data variables - loaded from backend via api-client.js
let epuletekData = [];
let nodeData = [];
let buildingGraph = {};
let currentMarker = null;
let currentPath = null;
let navigationState = {
    segments: [],
    currentStep: -1,
    roomData: null
};

// Helper functions - data is loaded by loadBackendData() from api-client.js
function findRoomData(roomName) {
    return nodeData.find(room => room.teremnev && room.teremnev.toLowerCase() === roomName.toLowerCase() && room.tipus && room.tipus === '1');
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

function drawBuildingMarker(x, y) {
    if (!lastDrawnImage.img) return;
    
    // Convert image coordinates to canvas coordinates
    const canvasX = lastDrawnImage.drawX + (x / lastDrawnImage.img.width) * lastDrawnImage.drawWidth;
    const canvasY = lastDrawnImage.drawY + (y / lastDrawnImage.img.height) * lastDrawnImage.drawHeight;
    
    // Draw simple dot marker - scaled with zoom
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 10 * zoomLevel, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2 * zoomLevel;
    ctx.stroke();
}

function drawMarker(x, y) {
    if (!lastDrawnImage.img) return;
    
    // Convert image coordinates to canvas coordinates
    const canvasX = lastDrawnImage.drawX + (x / lastDrawnImage.img.width) * lastDrawnImage.drawWidth;
    const canvasY = lastDrawnImage.drawY + (y / lastDrawnImage.img.height) * lastDrawnImage.drawHeight;
    
    const markerSize = 30 * zoomLevel;
    
    // Draw marker circle
    ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, markerSize, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw marker border
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = 2 * zoomLevel;
    ctx.stroke();
    
    // Draw marker point
    ctx.fillStyle = 'rgba(255, 0, 0, 1)';
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 6 * zoomLevel, 0, Math.PI * 2);
    ctx.fill();
}

function setImage(filename) {
    currentImageFilename = filename;

    zoomLevel = 1;
    offsetX = 0;
    offsetY = 0;
}

function drawImage(filename) {
    return new Promise((resolve) => {
        if (imageCache.has(filename)) {
            // Use cached image
            const img = imageCache.get(filename);
            renderImage(img);
            resolve();
        } else {
            // Load new image
            const img = new Image();
            img.src = filename;
            img.onload = () => {
                imageCache.set(filename, img);
                renderImage(img);
                resolve();
            };
        }
    });
}

function renderImage(img) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (!img.complete) return;
    
    // Calculate dimensions to fit image in canvas while keeping aspect ratio
    const imgAspect = img.width / img.height;
    const canvasAspect = canvas.width / canvas.height;
    
    let drawWidth, drawHeight;
    
    if (imgAspect > canvasAspect) {
        // Image is wider, fit to canvas width
        drawWidth = canvas.width;
        drawHeight = canvas.width / imgAspect;
    } else {
        // Image is taller, fit to canvas height
        drawHeight = canvas.height;
        drawWidth = canvas.height * imgAspect;
    }
    
    // Apply zoom
    drawWidth *= zoomLevel;
    drawHeight *= zoomLevel;
    
    // Center the image with offset for panning
    let x = (canvas.width - drawWidth) / 2 + offsetX;
    let y = (canvas.height - drawHeight) / 2 + offsetY;
    
    // Constrain panning to prevent image from going completely off-screen
    if (zoomLevel > MIN_ZOOM) {
        // Ensure at least some portion of the image remains visible
        const minVisiblePortion = 100; // Minimum pixels of image that must remain visible
        
        // Constrain horizontal panning
        const maxOffsetX = drawWidth - minVisiblePortion;
        const minOffsetX = canvas.width - drawWidth + minVisiblePortion;
        
        if (imgAspect > canvasAspect || drawWidth > canvas.width) {
            // Image is wider than canvas
            if (x > 0) x = 0;
            else if (x < canvas.width - drawWidth) x = canvas.width - drawWidth;
        } else {
            x = (canvas.width - drawWidth) / 2;
        }
        
        if (imgAspect < canvasAspect || drawHeight > canvas.height) {
            // Image is taller than canvas
            if (y > 0) y = 0;
            else if (y < canvas.height - drawHeight) y = canvas.height - drawHeight;
        } else {
            y = (canvas.height - drawHeight) / 2;
        }
        
        // Update offsetX and offsetY to match the constrained values
        offsetX = x - (canvas.width - drawWidth) / 2;
        offsetY = y - (canvas.height - drawHeight) / 2;
    }
    
    ctx.drawImage(img, x, y, drawWidth, drawHeight);

    // Store drawing information for click coordinate conversion
    lastDrawnImage = {
        img: img,
        drawX: x,
        drawY: y,
        drawWidth: drawWidth,
        drawHeight: drawHeight
    };
}

async function redrawCanvas() {
    await drawImage(currentImageFilename);
    
    // Redraw markers and paths if they exist
    if (navigationState.currentStep === -1 && navigationState.roomData) {
        const buildingData = findImageFilename(navigationState.roomData.epulet, navigationState.roomData.emelet);
        if (buildingData && buildingData.x && buildingData.y) {
            drawBuildingMarker(buildingData.x, buildingData.y);
        }
    } else if (currentPath) {
        const isLastSegment = navigationState.currentStep === navigationState.segments.length - 1;
        const roomX = isLastSegment && currentMarker ? currentMarker.x : null;
        const roomY = isLastSegment && currentMarker ? currentMarker.y : null;
        
        drawPathFromIds(currentPath, roomX, roomY, isLastSegment);
        
        if (currentMarker) {
            drawMarker(currentMarker.x, currentMarker.y);
        }
    }
}

// Mouse wheel zoom event listener
canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    
    if (!lastDrawnImage.img) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Store old zoom level
    const oldZoom = zoomLevel;
    
    // Calculate new zoom level
    const delta = -Math.sign(event.deltaY);
    zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel + delta * ZOOM_SPEED));
    
    // Reset pan when zooming back to minimum
    if (zoomLevel === MIN_ZOOM) {
        offsetX = 0;
        offsetY = 0;
    } else if (oldZoom !== zoomLevel) {
        // Calculate the mouse position relative to the image center before zoom
        const imgAspect = lastDrawnImage.img.width / lastDrawnImage.img.height;
        const canvasAspect = canvas.width / canvas.height;
        
        let baseWidth, baseHeight;
        if (imgAspect > canvasAspect) {
            baseWidth = canvas.width;
            baseHeight = canvas.width / imgAspect;
        } else {
            baseHeight = canvas.height;
            baseWidth = canvas.height * imgAspect;
        }
        
        // Calculate mouse position relative to the center of the canvas
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        // Mouse position relative to canvas center
        const mouseRelX = mouseX - centerX;
        const mouseRelY = mouseY - centerY;
        
        // Calculate the scale change
        const scaleChange = zoomLevel / oldZoom;
        
        // Adjust offset to keep the point under the cursor fixed
        offsetX = mouseRelX - (mouseRelX - offsetX) * scaleChange;
        offsetY = mouseRelY - (mouseRelY - offsetY) * scaleChange;
    }
    
    redrawCanvas();
});

// Mouse down event listener for panning
canvas.addEventListener('mousedown', (event) => {
    if (zoomLevel > MIN_ZOOM) {
        isDragging = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        canvas.style.cursor = 'grabbing';
    }
});

// Mouse move event listener for panning
canvas.addEventListener('mousemove', (event) => {
    if (isDragging && zoomLevel > MIN_ZOOM) {
        const deltaX = event.clientX - lastMouseX;
        const deltaY = event.clientY - lastMouseY;
        
        offsetX += deltaX;
        offsetY += deltaY;
        
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        
        redrawCanvas();
    } else if (zoomLevel > MIN_ZOOM) {
        canvas.style.cursor = 'grab';
    } else {
        canvas.style.cursor = 'default';
    }
});

// Mouse up event listener
canvas.addEventListener('mouseup', () => {
    isDragging = false;
    if (zoomLevel > MIN_ZOOM) {
        canvas.style.cursor = 'grab';
    } else {
        canvas.style.cursor = 'default';
    }
});

// Function to divide path IDs into segments based on epulet/emelet
function dividePathIntoSegments(pathIds) {
    if (!pathIds || pathIds.length === 0) return [];
    
    const segments = [];
    let currentSegment = [];
    let currentEpulet = null;
    let currentEmelet = null;
    
    for (const id of pathIds) {
        const csucok = findNodeById(id);
        if (!csucok) continue;
        
        // Check if we need to start a new segment
        if (currentEpulet !== csucok.epulet || currentEmelet !== csucok.emelet) {
            // Save the current segment if it has items
            if (currentSegment.length > 0) {
                segments.push(currentSegment);
            }
            // Start a new segment
            currentSegment = [id];
            currentEpulet = csucok.epulet;
            currentEmelet = csucok.emelet;
        } else {
            // Continue the current segment
            currentSegment.push(id);
        }
    }
    
    // Add the last segment
    if (currentSegment.length > 0) {
        segments.push(currentSegment);
    }
    
    return segments;
}

// Function to draw path from array of IDs
function drawPathFromIds(ids, roomX, roomY, isLastSegment) {
    if (!lastDrawnImage.img || !ids || ids.length === 0) return;
    
    const coordinates = [];
    
    // Get coordinates for each csucok in the path
    for (const id of ids) {
        const node = findNodeById(id);
        if (node && node.x && node.y) {
            coordinates.push({
                x: node.x,
                y: node.y
            });
        }
    }
    
    // Add the final room coordinates only if this is the last segment
    if (isLastSegment && roomX && roomY) {
        coordinates.push({
            x: roomX,
            y: roomY
        });
    }
    
    // Draw lines connecting all coordinates with alternating red-blue gradient
    if (coordinates.length > 1) {
        ctx.lineWidth = 3 * zoomLevel;
        // Draw each segment with alternating colors
        for (let i = 0; i < coordinates.length - 1; i++) {
            // Convert coordinates to canvas coordinates
            const startX = lastDrawnImage.drawX + (coordinates[i].x / lastDrawnImage.img.width) * lastDrawnImage.drawWidth;
            const startY = lastDrawnImage.drawY + (coordinates[i].y / lastDrawnImage.img.height) * lastDrawnImage.drawHeight;
            const endX = lastDrawnImage.drawX + (coordinates[i + 1].x / lastDrawnImage.img.width) * lastDrawnImage.drawWidth;
            const endY = lastDrawnImage.drawY + (coordinates[i + 1].y / lastDrawnImage.img.height) * lastDrawnImage.drawHeight;
            
            if (i == 0) {
                ctx.fillStyle = 'red';
                ctx.beginPath();
                ctx.arc(startX, startY, 6 * zoomLevel, 0, Math.PI * 2);
                ctx.fill();
            } else if (i === coordinates.length - 2 && !isLastSegment) {
                if (i % 2 === 0) ctx.fillStyle = 'blue';
                else ctx.fillStyle = 'red';
                ctx.beginPath();
                ctx.arc(endX, endY, 6 * zoomLevel, 0, Math.PI * 2);
                ctx.fill();
            }
                
            // Create gradient for this segment
            const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
            
            // Alternate between red and blue based on segment index
            if (i % 2 === 0) {
                gradient.addColorStop(0, 'red');
                gradient.addColorStop(1, 'blue');
            } else {
                gradient.addColorStop(0, 'blue');
                gradient.addColorStop(1, 'red');
            }
            
            ctx.strokeStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
        }
    }
}

function exitNavigationMode() {
    currentMarker = null;
    currentPath = null;
    navigationState = { segments: [], currentStep: -1, roomData: null };
    nextButton.className = 'disabled';
    nextButton.disabled = true;
}

// Load backend data first, then draw initial image
loadBackendData().then(() => {
    setImage(getDefaultMapFilename());
    redrawCanvas();
});

// Button event listeners
const searchButton = document.querySelector('#searchButton');
const nextButton = document.querySelector('#nextButton');

searchButton.addEventListener('click', async () => {
    const input = prompt('Adja meg a terem nevét:');
    if (input !== null && input.trim() !== '') {
        const roomData = findRoomData(input);
        
        if (!roomData) {
            alert('A terem nem található!');
            return;
        }
        
        // Find shortest path using epuletGraf
        let visited = new Set();
        let q = new PriorityQueue((a, b) => a.distance < b.distance);
        let pathFound = null;
        q.push({ node: roomData, distance: 0, path: [] });
        visited.add(roomData.id);
        while (!q.isEmpty()) {
            let node = q.pop();
            
            if (node.node.tipus === '2') {
                // Found a door, set the path and break
                pathFound = node.path.reverse();
                break;
            }
            console.log('Visiting node:', node.node.id, 'Distance:', node.distance);

            for (let neighbor of buildingGraph[node.node.id] || []) {
                if (visited.has(neighbor)) continue;
                visited.add(neighbor);

                let neighborNode = findNodeById(neighbor);

                let newPath = node.path.concat([neighbor]);

                let dist = neighborNode.x && neighborNode.y && node.node.x && node.node.y ?
                    Math.hypot(neighborNode.x - node.node.x, neighborNode.y - node.node.y) : 1;
                
                q.push({ node: neighborNode, distance: node.distance + dist, path: newPath });

            }   
        }

        // Divide the path into segments by epulet/emelet
        const segments = dividePathIntoSegments(pathFound || []);

        // Initialize navigation state
        navigationState = {
            segments: segments,
            currentStep: -1,
            roomData: roomData
        };
        
        // Draw campus map first
        setImage(getDefaultMapFilename());
        redrawCanvas();
        
        // Show and enable next button with primary class
        nextButton.className = 'primary';
        nextButton.disabled = false;
        
        currentMarker = null;
        currentPath = null;
    }
});

nextButton.addEventListener('click', async () => {
    if (nextButton.disabled || navigationState.currentStep >= navigationState.segments.length) return;
    
    navigationState.currentStep++;
    
    if (navigationState.currentStep < navigationState.segments.length) {
        const segmentIds = navigationState.segments[navigationState.currentStep];
        const isLastSegment = navigationState.currentStep === navigationState.segments.length - 1;
        
        // Get the first node to determine building/floor
        const firstNode = findNodeById(segmentIds[0]);
        if (!firstNode) {
            alert('Csúcspont nem található!');
            return;
        }
        
        // Draw the building's image
        const buildingData = findImageFilename(firstNode.epulet, firstNode.emelet);
        if (!buildingData || !buildingData.filename) {
            alert('Az épület/szint térkép nem található!');
            return;
        }
        
        setImage(buildingData.filename);
        redrawCanvas();
        
        // Draw the path for this segment
        const roomX = isLastSegment ? navigationState.roomData.x : null;
        const roomY = isLastSegment ? navigationState.roomData.y : null;
        
        currentPath = segmentIds;
        currentMarker = (isLastSegment && roomX && roomY) ? { x: roomX, y: roomY } : null;

        redrawCanvas();
        
        // Check if this is the last segment
        if (navigationState.currentStep === navigationState.segments.length - 1) {
            nextButton.className = 'disabled';
            nextButton.disabled = true;
        }
    }
});

const returnButton = document.querySelector('#returnButton');
returnButton.addEventListener('click', () => {
    exitNavigationMode();

    setImage(getDefaultMapFilename());
    redrawCanvas();
});

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth - SIDEBAR_WIDTH;
    canvas.height = window.innerHeight;

    redrawCanvas();
});
