const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const searchArrow = document.getElementById('searchArrow');
const nextArrow = document.getElementById('nextArrow');
const doorButton = document.getElementById('doorButton');
const doorArrow = document.getElementById('doorArrow');
const mapArrow = document.getElementById('mapArrow');
const doorModal = document.getElementById('doorModal');
const doorList = document.getElementById('doorList');
const searchButton = document.getElementById('searchButton');
const nextButton = document.getElementById('nextButton');
const returnButton = document.getElementById('returnButton');
const roomSearchModal = document.getElementById('roomSearchModal');
const roomSearchInput = document.getElementById('roomSearchInput');
const roomSearchList = document.getElementById('roomSearchList');
const roomSearchHint = document.getElementById('roomSearchHint');

// Check if sidebar is currently visible
function isSidebarVisible() {
    if (window.innerWidth <= 768) {
        return sidebar.classList.contains('open');
    } else {
        return !sidebar.classList.contains('hidden');
    }
}

// Get current sidebar width based on visibility
function getSidebarWidth() {
    return isSidebarVisible() ? 250 : 0;
}

// Update canvas size and position
function updateCanvasSize() {
    const sidebarWidth = getSidebarWidth();
    canvas.width = window.innerWidth - sidebarWidth;
    canvas.height = window.innerHeight;
    canvas.style.left = sidebarWidth + 'px';
}

// Update floating buttons visibility and state
function updateFloatingButtonsVisibility() {
    const sidebarHidden = !isSidebarVisible();
    const isNavigating = navigationState.currentStep >= -1 && navigationState.segments.length > 0;
    const nextEnabled = nextButton && !nextButton.disabled;
    const hasMultipleDoors = navigationState.availableDoors?.length > 1;
    const doorEnabled = navigationState.currentStep >= 0 && hasMultipleDoors;

    // Search button - always visible when sidebar is hidden
    if (searchArrow) {
        if (sidebarHidden) {
            searchArrow.classList.add('visible');
        } else {
            searchArrow.classList.remove('visible');
        }
    }

    // Next arrow - visible when navigating
    if (nextArrow) {
        if (sidebarHidden && isNavigating) {
            nextArrow.classList.add('visible');
            if (nextEnabled) {
                nextArrow.classList.remove('disabled');
                nextArrow.disabled = false;
            } else {
                nextArrow.classList.add('disabled');
                nextArrow.disabled = true;
            }
        } else {
            nextArrow.classList.remove('visible');
            nextArrow.classList.remove('disabled');
        }
    }

    // Door button - visible when navigating and multiple doors available
    if (doorArrow) {
        if (sidebarHidden && doorEnabled) {
            doorArrow.classList.add('visible');
        } else {
            doorArrow.classList.remove('visible');
        }
    }

    // Door button in sidebar
    if (doorButton) {
        doorButton.style.display = 'block';
        doorButton.disabled = !doorEnabled;
        doorButton.className = doorEnabled ? 'btn-success' : 'disabled';
    }

    // Map button - visible when navigating
    if (mapArrow) {
        if (sidebarHidden && isNavigating) {
            mapArrow.classList.add('visible');
        } else {
            mapArrow.classList.remove('visible');
        }
    }
}

function isCampusMap() {
    if (!currentFloor?.id || !campusFloorId) return false;
    return currentFloor.id === campusFloorId;
}

function updateReturnButtonState() {
    if (!returnButton) return;
    const isNavigating = navigationState.currentStep >= -1 && navigationState.segments.length > 0;
    const shouldDisable = isCampusMap() && !isNavigating;
    returnButton.disabled = shouldDisable;
    returnButton.className = shouldDisable ? 'disabled' : 'btn-black';
}

// Alias for backward compatibility
function updateNextArrowVisibility() {
    updateFloatingButtonsVisibility();
}

// Update door button visibility (now handled by updateFloatingButtonsVisibility)
function updateDoorButtonVisibility() {
    updateFloatingButtonsVisibility();
}

// Toggle sidebar visibility
function toggleSidebar() {
    if (window.innerWidth <= 768) {
        sidebar.classList.toggle('open');
    } else {
        sidebar.classList.toggle('hidden');
    }
    updateCanvasSize();
    updateNextArrowVisibility();
    updateDoorButtonVisibility();
    redrawCanvas();
}

// Close sidebar on mobile
function closeSidebarOnMobile() {
    if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        updateCanvasSize();
        updateNextArrowVisibility();
        redrawCanvas();
    }
}

// Initialize canvas size
updateCanvasSize();

// Menu toggle click handler
if (menuToggle) {
    menuToggle.addEventListener('click', toggleSidebar);
}

// Search arrow click handler
if (searchArrow) {
    searchArrow.addEventListener('click', () => {
        // Trigger the search button click
        if (searchButton) {
            searchButton.click();
        }
    });
}

// Next arrow click handler
if (nextArrow) {
    nextArrow.addEventListener('click', () => {
        // Trigger the next button click (only if not disabled)
        if (!nextArrow.disabled && nextButton && !nextButton.disabled) {
            nextButton.click();
        }
    });
}

// Map arrow click handler
if (mapArrow) {
    mapArrow.addEventListener('click', () => {
        // Trigger the return button click
        if (returnButton && !returnButton.disabled) {
            returnButton.click();
        }
    });
}

// Door modal functions
function openDoorModal() {
    if (!navigationState.availableDoors?.length) return;

    doorList.innerHTML = '';
    navigationState.availableDoors.forEach((door, index) => {
        const li = document.createElement('li');
        li.className = 'door-item' + (index === navigationState.currentDoorIndex ? ' current' : '');

        const baseName = door.node.teremnev || `Bejárat ${index + 1}`;
        const emelet = door.node.emelet ?? '?';
        const doorName = `${baseName} (emelet: ${emelet})`;
        li.innerHTML = `
            <div class="door-name">${doorName}</div>
            <div class="door-distance">Távolság: ${Math.round(door.distance)}</div>
        `;

        li.addEventListener('click', () => {
            selectDoor(index);
            doorModal.style.display = 'none';
        });

        doorList.appendChild(li);
    });

    doorModal.style.display = 'block';
}

function selectDoor(doorIndex) {
    if (!navigationState.availableDoors || doorIndex >= navigationState.availableDoors.length) return;

    navigationState.currentDoorIndex = doorIndex;
    const selectedDoor = navigationState.availableDoors[doorIndex];
    const segments = dividePathIntoSegments(selectedDoor.path);

    navigationState.segments = segments;
    navigationState.currentStep = 0;

    if (segments.length > 0) {
        const segmentIds = segments[0];
        const isLastSegment = segments.length === 1;
        const firstNode = findNodeById(segmentIds[0]);

        if (firstNode) {
            const floorEntry = findFloorByBuildingAndLevel(firstNode.epulet, firstNode.emelet);
            if (floorEntry?.id) {
                setCurrentFloorById(floorEntry.id);
                currentPath = segmentIds;
                currentMarker = isLastSegment ? { x: navigationState.roomData.x, y: navigationState.roomData.y } : null;
                redrawCanvas();
            }
        }
    }

    nextButton.className = navigationState.currentStep >= navigationState.segments.length - 1 ? 'disabled' : 'primary';
    nextButton.disabled = navigationState.currentStep >= navigationState.segments.length - 1;
    updateNextArrowVisibility();
    updateDoorButtonVisibility();
    updateReturnButtonState();
}

// Door button click handlers
if (doorButton) {
    doorButton.addEventListener('click', () => {
        closeSidebarOnMobile();
        if (doorButton.disabled) return;
        openDoorModal();
    });
}

if (doorArrow) {
    doorArrow.addEventListener('click', () => {
        openDoorModal();
    });
}

const imageCache = new Map();
let currentFloor = null;
let campusFloorId = null;
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
let floorsData = [];
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

function getFloorById(id) {
    if (!Array.isArray(floorsData)) return null;
    return floorsData.find(floor => floor.id === id) || null;
}

function findFloorByBuildingAndLevel(epulet, emelet) {
    if (!Array.isArray(floorsData)) return null;
    return floorsData.find(floor =>
        floor.epulet === epulet && floor.emelet === emelet
    ) || null;
}

function getDefaultCampusFloor() {
    if (!Array.isArray(floorsData)) return null;
    return floorsData.find(floor => floor.epulet === 'KAMPUSZ') || null;
}

function getCurrentFloorFilename() {
    return currentFloor?.filename || 'map_en.jpg';
}

// Get scale factor to convert image pixels to canvas pixels
function getImageScale() {
    if (!lastDrawnImage.img || !lastDrawnImage.img.width) return 1;
    return lastDrawnImage.drawWidth / lastDrawnImage.img.width;
}

function drawBuildingMarker(x, y) {
    if (!lastDrawnImage.img) return;

    const scale = getImageScale();

    // Convert image coordinates to canvas coordinates
    const canvasX = lastDrawnImage.drawX + (x / lastDrawnImage.img.width) * lastDrawnImage.drawWidth;
    const canvasY = lastDrawnImage.drawY + (y / lastDrawnImage.img.height) * lastDrawnImage.drawHeight;

    // Draw simple dot marker - sized in image pixels
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 10 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
}

function drawMarker(x, y) {
    if (!lastDrawnImage.img) return;

    const scale = getImageScale();

    // Convert image coordinates to canvas coordinates
    const canvasX = lastDrawnImage.drawX + (x / lastDrawnImage.img.width) * lastDrawnImage.drawWidth;
    const canvasY = lastDrawnImage.drawY + (y / lastDrawnImage.img.height) * lastDrawnImage.drawHeight;

    const markerSize = 60 * scale;

    // Draw marker circle
    ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, markerSize, 0, Math.PI * 2);
    ctx.fill();

    // Draw marker border
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    // Draw marker point
    ctx.fillStyle = 'rgba(255, 0, 0, 1)';
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 12 * scale, 0, Math.PI * 2);
    ctx.fill();
}

function setCurrentFloor(floor) {
    currentFloor = floor;

    zoomLevel = 1;
    offsetX = 0;
    offsetY = 0;

    updateReturnButtonState();

    if (typeof window.onCurrentFloorChanged === 'function') {
        window.onCurrentFloorChanged(currentFloor);
    }
}

function setCurrentFloorById(floorId) {
    const floor = getFloorById(floorId);
    if (!floor) {
        console.warn('Unknown floor id:', floorId);
        return;
    }
    setCurrentFloor(floor);
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
    await drawImage(getCurrentFloorFilename());
    
    // Redraw markers and paths if they exist
    if (navigationState.currentStep === -1 && navigationState.roomData) {
        const floorEntry = findFloorByBuildingAndLevel(navigationState.roomData.epulet, navigationState.roomData.emelet);
        if (floorEntry && floorEntry.x && floorEntry.y) {
            drawBuildingMarker(floorEntry.x, floorEntry.y);
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

    const scale = getImageScale();
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
        ctx.lineWidth = 6 * scale;
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
                ctx.arc(startX, startY, 12 * scale, 0, Math.PI * 2);
                ctx.fill();
            } else if (i === coordinates.length - 2 && !isLastSegment) {
                if (i % 2 === 0) ctx.fillStyle = 'blue';
                else ctx.fillStyle = 'red';
                ctx.beginPath();
                ctx.arc(endX, endY, 12 * scale, 0, Math.PI * 2);
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
    navigationState = { segments: [], currentStep: -1, roomData: null, availableDoors: [], currentDoorIndex: 0 };
    nextButton.className = 'disabled';
    nextButton.disabled = true;
    updateNextArrowVisibility();
    updateDoorButtonVisibility();
    updateReturnButtonState();
}

// Initialize application - called externally after auth check
async function initializeApp() {
    try {
        await loadBackendData();
        const campusFloor = getDefaultCampusFloor();
        campusFloorId = campusFloor?.id || null;

        if (campusFloor?.id) {
            setCurrentFloorById(campusFloor.id);
        } else if (Array.isArray(floorsData) && floorsData.length > 0) {
            setCurrentFloorById(floorsData[0].id);
        }

        updateReturnButtonState();
        await redrawCanvas();
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        throw error;
    }
}

// Export for external coordination
window.initializeApp = initializeApp;

// Auto-initialize for index.html (dev.html coordinates via dev.js)
// Wait briefly to allow dev.js to take over if present
setTimeout(async () => {
    // If initializeApp hasn't been called yet (no coordination from dev.js)
    if (!window.appInitialized) {
        console.log('Auto-initializing for index.html');
        try {
            // On index.html, check auth first then initialize
            await API.checkAuth();
            await initializeApp();
            window.appInitialized = true;
        } catch (error) {
            console.error('Auto-initialization failed:', error);
        }
    }
}, 100);

function isRoomNode(node) {
    return !!node && node.tipus === '1' && !!node.teremnev;
}

function getRoomSearchRooms() {
    if (!Array.isArray(nodeData)) return [];
    const rooms = [];
    for (const node of nodeData) {
        if (!isRoomNode(node)) continue;
        if (window.RoomSearch?.ensureSearchKey) window.RoomSearch.ensureSearchKey(node);
        rooms.push(node);
    }
    return rooms;
}

function startNavigationToRoom(roomData) {
    if (!roomData) return;

    // Find shortest path using epuletGraf - find ALL doors
    const visited = new Set();
    const q = new PriorityQueue((a, b) => a.distance < b.distance);
    const allDoorsFound = [];
    let firstDoorPath = null;

    q.push({ node: roomData, distance: 0, path: [] });
    visited.add(roomData.id);

    while (!q.isEmpty()) {
        const node = q.pop();

        if (node.node.tipus === '2') {
            allDoorsFound.push({
                node: node.node,
                path: node.path.slice().reverse(),
                distance: node.distance
            });
            if (!firstDoorPath) {
                firstDoorPath = node.path.slice().reverse();
            }
            continue;
        }

        for (const neighbor of buildingGraph[node.node.id] || []) {
            if (visited.has(neighbor)) continue;
            visited.add(neighbor);

            const neighborNode = findNodeById(neighbor);
            const newPath = node.path.concat([neighbor]);
            const dist = neighborNode.x && neighborNode.y && node.node.x && node.node.y ?
                Math.hypot(neighborNode.x - node.node.x, neighborNode.y - node.node.y) : 1;

            q.push({ node: neighborNode, distance: node.distance + dist, path: newPath });
        }
    }

    // Divide the path into segments by epulet/emelet
    const segments = dividePathIntoSegments(firstDoorPath || []);

    // Initialize navigation state
    navigationState = {
        segments: segments,
        currentStep: -1,
        roomData: roomData,
        availableDoors: allDoorsFound,
        currentDoorIndex: 0
    };

    // Draw campus map first
    const campusFloor = getDefaultCampusFloor();
    if (campusFloor?.id) {
        setCurrentFloorById(campusFloor.id);
    }
    redrawCanvas();

    // Show and enable next button with primary class
    nextButton.className = 'primary';
    nextButton.disabled = false;
    updateNextArrowVisibility();

    currentMarker = null;
    currentPath = null;
}

function createVirtualList(containerEl, rowHeight, renderItem, onItemClick) {
    const spacer = document.createElement('div');
    spacer.className = 'virtual-list-spacer';
    containerEl.innerHTML = '';
    containerEl.appendChild(spacer);

    let items = [];
    let selectedIndex = -1;

    const pool = [];
    const buffer = 6;

    function render() {
        const scrollTop = containerEl.scrollTop;
        const viewportHeight = containerEl.clientHeight || 0;
        const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
        const visibleCount = Math.ceil(viewportHeight / rowHeight) + buffer * 2;
        const endIndex = Math.min(items.length, startIndex + visibleCount);
        const needed = endIndex - startIndex;

        while (pool.length < needed) {
            const el = document.createElement('div');
            el.className = 'virtual-list-item';
            el.setAttribute('role', 'option');
            el.style.height = `${rowHeight}px`;
            spacer.appendChild(el);
            pool.push(el);
        }
        while (pool.length > needed) {
            const el = pool.pop();
            spacer.removeChild(el);
        }

        for (let i = 0; i < pool.length; i++) {
            const itemIndex = startIndex + i;
            const item = items[itemIndex];
            const el = pool[i];
            el.style.top = `${itemIndex * rowHeight}px`;
            el.setAttribute('aria-selected', itemIndex === selectedIndex ? 'true' : 'false');
            el.classList.toggle('top-match', itemIndex === selectedIndex);
            el.onclick = () => {
                selectedIndex = itemIndex;
                render();
                onItemClick(itemIndex, item);
            };
            renderItem(el, item, itemIndex);
        }
    }

    containerEl.addEventListener('scroll', render);

    return {
        setItems(newItems, nextSelectedIndex = -1) {
            items = Array.isArray(newItems) ? newItems : [];
            selectedIndex = nextSelectedIndex;
            spacer.style.height = `${items.length * rowHeight}px`;
            containerEl.scrollTop = 0;
            render();
        },
        getItems() {
            return items;
        },
        setSelectedIndex(index) {
            selectedIndex = index;
            render();
        },
        getSelectedIndex() {
            return selectedIndex;
        },
        scrollToIndex(index) {
            if (index < 0 || index >= items.length) return;
            containerEl.scrollTop = index * rowHeight;
            render();
        }
    };
}

const roomSearchUI = {
    virtualList: null,
    results: []
};

const ROOM_SEARCH_ROW_HEIGHT = 54;

function updateRoomSearchListHeight(resultsCount) {
    if (!roomSearchList || !roomSearchModal) return;
    const contentEl = roomSearchModal.querySelector('.room-search-content');
    if (!contentEl) return;

    const styles = getComputedStyle(contentEl);
    const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;

    const headerEl = contentEl.querySelector('.modal-header');
    const headerHeight = headerEl ? headerEl.offsetHeight : 0;
    const inputHeight = roomSearchInput ? roomSearchInput.offsetHeight : 0;
    const hintHeight = roomSearchHint && roomSearchHint.style.display !== 'none' ? roomSearchHint.offsetHeight : 0;

    const gap = 20;

    let maxModalHeight;
    if (window.innerWidth <= 480) {
        maxModalHeight = window.innerHeight - 16;
    } else if (window.innerWidth <= 768) {
        maxModalHeight = window.innerHeight - 24;
    } else {
        maxModalHeight = Math.floor(window.innerHeight * 0.8);
    }

    const maxListHeight = Math.max(120, maxModalHeight - paddingTop - paddingBottom - headerHeight - inputHeight - hintHeight - gap);
    const minListHeight = resultsCount > 0 ? ROOM_SEARCH_ROW_HEIGHT * 3 : 120;
    const desiredListHeight = Math.min(maxListHeight, Math.max(minListHeight, resultsCount * ROOM_SEARCH_ROW_HEIGHT));
    roomSearchList.style.height = `${desiredListHeight}px`;
}

const floorSortIdCache = new Map();

function getFloorSortIdForRoom(room) {
    const epulet = room?.epulet || '';
    const emelet = room?.emelet ?? '';
    const key = `${epulet}|${emelet}`;
    if (floorSortIdCache.has(key)) return floorSortIdCache.get(key);

    const floorEntry = findFloorByBuildingAndLevel(epulet, emelet);
    const floorId = floorEntry?.id != null ? Number(floorEntry.id) : Number.POSITIVE_INFINITY;
    const safeFloorId = Number.isFinite(floorId) ? floorId : Number.POSITIVE_INFINITY;
    floorSortIdCache.set(key, safeFloorId);
    return safeFloorId;
}

function formatRoomMeta(room) {
    const epulet = room?.epulet || '?';
    const emelet = room?.emelet ?? '?';
    return `${epulet} - ${emelet}`;
}

function renderRoomSearchItem(el, room) {
    if (!el._nameEl) {
        el.innerHTML = '';
        const nameEl = document.createElement('span');
        nameEl.className = 'room-item-name';
        const metaEl = document.createElement('span');
        metaEl.className = 'room-item-meta';
        el.appendChild(nameEl);
        el.appendChild(metaEl);
        el._nameEl = nameEl;
        el._metaEl = metaEl;
    }

    el._nameEl.textContent = room?.teremnev || '';
    el._metaEl.textContent = `(${formatRoomMeta(room)})`;
}

function closeRoomSearchModal() {
    if (!roomSearchModal) return;
    roomSearchModal.style.display = 'none';
}

function openRoomSearchModal() {
    if (!roomSearchModal || !roomSearchInput || !roomSearchList || !roomSearchHint) return;

    roomSearchModal.style.display = 'block';
    roomSearchInput.value = '';
    roomSearchHint.textContent = 'Kezdj el gépelni (min. 1 karakter)...';
    roomSearchHint.style.display = '';

    if (!roomSearchUI.virtualList) {
        roomSearchUI.virtualList = createVirtualList(
            roomSearchList,
            ROOM_SEARCH_ROW_HEIGHT,
            renderRoomSearchItem,
            (index) => selectRoomSearchResult(index)
        );
    }

    roomSearchUI.results = [];
    roomSearchUI.virtualList.setItems([]);
    updateRoomSearchListHeight(0);

    setTimeout(() => roomSearchInput.focus(), 0);
}

window.addEventListener('resize', () => {
    if (roomSearchModal && roomSearchModal.style.display === 'block') {
        updateRoomSearchListHeight(roomSearchUI.results.length);
    }
});

function applyRoomSearchFilter(query) {
    if (!roomSearchUI.virtualList || !roomSearchHint) return;
    const normalized = window.RoomSearch?.normalizeText ? window.RoomSearch.normalizeText(query) : (query || '').trim().toLowerCase();

    if (!normalized || normalized.length < (window.RoomSearch?.MIN_QUERY_LENGTH || 2)) {
        roomSearchUI.results = [];
        roomSearchHint.textContent = 'Kezdj el gépelni (min. 1 karakter)...';
        roomSearchHint.style.display = '';
        roomSearchUI.virtualList.setItems([]);
        updateRoomSearchListHeight(0);
        return;
    }

    const rooms = getRoomSearchRooms();
    const results = [];
    for (const room of rooms) {
        const key = room.teremnev_searchKey || '';
        if (key.startsWith(normalized)) results.push(room);
    }

    if (results.length === 0) {
        roomSearchHint.textContent = 'Nincs találat.';
        roomSearchHint.style.display = '';
        roomSearchUI.results = [];
        roomSearchUI.virtualList.setItems([]);
        updateRoomSearchListHeight(0);
        return;
    }

    if (results.length <= 2000) {
        results.sort((a, b) => {
            const buildingCmp = a.epulet.localeCompare(b.epulet, 'hu');
            if (buildingCmp !== 0) return buildingCmp;

            const floorIdA = getFloorSortIdForRoom(a);
            const floorIdB = getFloorSortIdForRoom(b);
            if (floorIdA !== floorIdB) return floorIdA - floorIdB;

            const roomCmp = a.teremnev.localeCompare(b.teremnev, 'hu');
            if (roomCmp !== 0) return roomCmp;

            return Number(a.id) - Number(b.id);
        });
    }

    roomSearchHint.textContent = `Találatok: ${results.length}`;
    roomSearchHint.style.display = '';

    roomSearchUI.results = results;
    roomSearchUI.virtualList.setItems(results, 0);
    updateRoomSearchListHeight(results.length);
}

function selectRoomSearchResult(index) {
    const room = roomSearchUI.results[index];
    if (!room) return;
    if (roomSearchInput) roomSearchInput.value = room.teremnev || '';
    closeRoomSearchModal();
    startNavigationToRoom(room);
}

if (roomSearchInput) {
    let debounceTimer = null;
    roomSearchInput.addEventListener('input', () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => applyRoomSearchFilter(roomSearchInput.value), 80);
    });

    roomSearchInput.addEventListener('keydown', (e) => {
        if (!roomSearchUI.virtualList) return;
        const results = roomSearchUI.virtualList.getItems();
        const selected = roomSearchUI.virtualList.getSelectedIndex();

        if (e.key === 'Enter') {
            e.preventDefault();
            selectRoomSearchResult(selected >= 0 ? selected : 0);
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = selected < 0 ? 0 : Math.min(results.length - 1, selected + 1);
            roomSearchUI.virtualList.setSelectedIndex(next);
            roomSearchUI.virtualList.scrollToIndex(next);
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const next = selected < 0 ? 0 : Math.max(0, selected - 1);
            roomSearchUI.virtualList.setSelectedIndex(next);
            roomSearchUI.virtualList.scrollToIndex(next);
        }
    });
}

// Button event listeners
searchButton.addEventListener('click', async () => {
    closeSidebarOnMobile();
    openRoomSearchModal();
    return;

    const input = prompt('Adja meg a terem nevét:');
    if (input !== null && input.trim() !== '') {
        const roomData = findRoomData(input);

        if (!roomData) {
            alert('A terem nem található!');
            return;
        }

        // Find shortest path using epuletGraf - find ALL doors
        let visited = new Set();
        let q = new PriorityQueue((a, b) => a.distance < b.distance);
        let pathFound = null;
        let allDoorsFound = [];
        let firstDoorPath = null;
        q.push({ node: roomData, distance: 0, path: [] });
        visited.add(roomData.id);
        while (!q.isEmpty()) {
            let node = q.pop();

            if (node.node.tipus === '2') {
                // Found a door - store it and continue searching
                allDoorsFound.push({
                    node: node.node,
                    path: node.path.slice().reverse(),
                    distance: node.distance
                });
                if (!firstDoorPath) {
                    firstDoorPath = node.path.slice().reverse();
                }
                continue; // Don't break - keep searching for more doors
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

        pathFound = firstDoorPath;

        // Divide the path into segments by epulet/emelet
        const segments = dividePathIntoSegments(pathFound || []);

        // Initialize navigation state
        navigationState = {
            segments: segments,
            currentStep: -1,
            roomData: roomData,
            availableDoors: allDoorsFound,
            currentDoorIndex: 0
        };

        // Draw campus map first
        const campusFloor = getDefaultCampusFloor();
        if (campusFloor?.id) {
            setCurrentFloorById(campusFloor.id);
        }
        redrawCanvas();

        // Show and enable next button with primary class
        nextButton.className = 'primary';
        nextButton.disabled = false;
        updateNextArrowVisibility();

        currentMarker = null;
        currentPath = null;
    }
});

nextButton.addEventListener('click', async () => {
    if (nextButton.disabled || navigationState.currentStep >= navigationState.segments.length) return;

    closeSidebarOnMobile();
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
        const floorEntry = findFloorByBuildingAndLevel(firstNode.epulet, firstNode.emelet);
        if (!floorEntry || !floorEntry.id) {
            alert('Az épület/szint térkép nem található!');
            return;
        }

        setCurrentFloorById(floorEntry.id);
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
            updateNextArrowVisibility();
        }
        updateDoorButtonVisibility();
    }
});

	returnButton.addEventListener('click', () => {
	    closeSidebarOnMobile();
	    if (returnButton.disabled) return;
	    exitNavigationMode();

	    const campusFloor = getDefaultCampusFloor();
	    if (campusFloor?.id) {
	        setCurrentFloorById(campusFloor.id);
	    }
	    redrawCanvas();
	});

window.addEventListener('resize', () => {
    // Close mobile sidebar on resize to desktop
    if (window.innerWidth > 768 && sidebar) {
        sidebar.classList.remove('open');
    }

    updateCanvasSize();
    updateNextArrowVisibility();
    updateDoorButtonVisibility();
    redrawCanvas();
});

// Fullscreen support for mobile
function isMobile() {
    return window.innerWidth <= 768 || 'ontouchstart' in window;
}

function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
}

function requestFullscreen() {
    if (isFullscreen()) return;

    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
    }
}

// Handle fullscreen change - resize canvas when entering/exiting fullscreen
document.addEventListener('fullscreenchange', () => {
    updateCanvasSize();
    redrawCanvas();
});
document.addEventListener('webkitfullscreenchange', () => {
    updateCanvasSize();
    redrawCanvas();
});

// Touch support for mobile
let touchStartX = 0;
let touchStartY = 0;
let lastTouchDistance = 0;

canvas.addEventListener('touchstart', (event) => {
    // Request fullscreen on touch (mobile only)
    if (isMobile() && !isFullscreen()) {
        requestFullscreen();
    }
    if (event.touches.length === 1) {
        // Single touch - start panning
        const touch = event.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;

        if (zoomLevel > MIN_ZOOM) {
            isDragging = true;
            lastMouseX = touch.clientX;
            lastMouseY = touch.clientY;
        }
    } else if (event.touches.length === 2) {
        // Two finger touch - prepare for pinch zoom
        event.preventDefault();
        isDragging = false;
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
    }
}, { passive: false });

canvas.addEventListener('touchmove', (event) => {
    if (event.touches.length === 1 && isDragging && zoomLevel > MIN_ZOOM) {
        // Single touch pan
        event.preventDefault();
        const touch = event.touches[0];
        const deltaX = touch.clientX - lastMouseX;
        const deltaY = touch.clientY - lastMouseY;

        offsetX += deltaX;
        offsetY += deltaY;

        lastMouseX = touch.clientX;
        lastMouseY = touch.clientY;

        redrawCanvas();
    } else if (event.touches.length === 2) {
        // Pinch zoom
        event.preventDefault();
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (lastTouchDistance > 0) {
            const scale = distance / lastTouchDistance;
            const oldZoom = zoomLevel;
            zoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoomLevel * scale));

            if (zoomLevel === MIN_ZOOM) {
                offsetX = 0;
                offsetY = 0;
            }

            redrawCanvas();
        }

        lastTouchDistance = distance;
    }
}, { passive: false });

canvas.addEventListener('touchend', (event) => {
    isDragging = false;
    lastTouchDistance = 0;
});

// Close door modal when clicking X
document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
        const modalId = closeBtn.getAttribute('data-modal');
        if (modalId) {
            document.getElementById(modalId).style.display = 'none';
        }
    });
});

// Close door modal when clicking outside
window.addEventListener('click', (event) => {
    if (doorModal && event.target === doorModal) {
        doorModal.style.display = 'none';
    }
    if (roomSearchModal && event.target === roomSearchModal) {
        roomSearchModal.style.display = 'none';
    }
});

// Close modals when pressing Escape
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        if (doorModal) doorModal.style.display = 'none';
        if (roomSearchModal) roomSearchModal.style.display = 'none';
    }
});
