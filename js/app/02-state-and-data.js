const imageCache = new Map();
const iconCache = new Map();
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
const ZOOM_SPEED = 0.1;
let currentMarker = null;
let currentPath = null;
let navigationState = {
    segments: [],
    currentStep: -1,
    roomData: null
};

// Ensure floating buttons match initial sidebar state (important on mobile where the sidebar starts closed).
updateFloatingButtonsVisibility();

// Helper functions - data is loaded by loadBackendData() from api-client.js
function findRoomData(roomName) {
    return nodeData.find(room => room.room_name && room.room_name.toLowerCase() === roomName.toLowerCase() && String(room.node_type) === '1');
}

function findNodeById(id) {
    return nodeData.find(room => room.id == id);
}

function getFloorById(id) {
    if (!Array.isArray(floorsData)) return null;
    return floorsData.find(floor => floor.id === id) || null;
}

function findFloorByBuildingAndFloor(building, floorName) {
    if (!Array.isArray(floorsData)) return null;
    return floorsData.find(floor =>
        floor.building === building && floor.floor === floorName
    ) || null;
}

function getDefaultCampusFloor() {
    if (!Array.isArray(floorsData)) return null;
    return floorsData.find(floor => floor.building === 'KAMPUSZ') || null;
}

function isCampusFloor(floor) {
    return !!floor && floor.building === 'KAMPUSZ';
}

function getCurrentFloorFilename() {
    return currentFloor?.filename || 'map_en.jpg';
}

// Get scale factor to convert image pixels to canvas pixels
function getImageScale() {
    if (!lastDrawnImage.img || !lastDrawnImage.img.width) return 1;
    return lastDrawnImage.drawWidth / lastDrawnImage.img.width;
}

function imageToCanvasPoint(imgX, imgY) {
    if (!lastDrawnImage.img) return null;
    if (imgX == null || imgY == null) return null;

    return {
        x: lastDrawnImage.drawX + (imgX / lastDrawnImage.img.width) * lastDrawnImage.drawWidth,
        y: lastDrawnImage.drawY + (imgY / lastDrawnImage.img.height) * lastDrawnImage.drawHeight
    };
}

function canvasToImagePoint(canvasX, canvasY) {
    if (!lastDrawnImage.img) return null;
    if (canvasX == null || canvasY == null) return null;

    const withinX = canvasX >= lastDrawnImage.drawX && canvasX <= lastDrawnImage.drawX + lastDrawnImage.drawWidth;
    const withinY = canvasY >= lastDrawnImage.drawY && canvasY <= lastDrawnImage.drawY + lastDrawnImage.drawHeight;
    if (!withinX || !withinY) return null;

    const relativeX = canvasX - lastDrawnImage.drawX;
    const relativeY = canvasY - lastDrawnImage.drawY;

    return {
        x: Math.floor((relativeX / lastDrawnImage.drawWidth) * lastDrawnImage.img.width),
        y: Math.floor((relativeY / lastDrawnImage.drawHeight) * lastDrawnImage.img.height)
    };
}

function drawBuildingMarker(x, y) {
    if (!lastDrawnImage.img) return;

    const scale = getImageScale();

    const pt = imageToCanvasPoint(x, y);
    if (!pt) return;

    // Draw simple dot marker - sized in image pixels
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 10 * scale, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();
}

function drawMarker(x, y) {
    if (!lastDrawnImage.img) return;

    const scale = getImageScale();

    const pt = imageToCanvasPoint(x, y);
    if (!pt) return;

    const markerSize = 60 * scale;

    // Draw marker circle
    ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, markerSize, 0, Math.PI * 2);
    ctx.fill();

    // Draw marker border
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)';
    ctx.lineWidth = 2 * scale;
    ctx.stroke();

    // Draw marker point
    ctx.fillStyle = 'rgba(255, 0, 0, 1)';
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 12 * scale, 0, Math.PI * 2);
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

function isNavigating() {
    return navigationState.currentStep >= -1 && Array.isArray(navigationState.segments) && navigationState.segments.length > 0;
}

function getBuildingFloors(building) {
    if (!Array.isArray(floorsData)) return [];
    return floorsData.filter(f => f.building === building).slice();
}

function sortFloorsById(floors) {
    return floors.sort((a, b) => Number(a.id) - Number(b.id));
}

function chooseDefaultFloorForBuilding(building) {
    const floors = getBuildingFloors(building);
    if (floors.length === 0) return null;

    const buildingMeta = Array.isArray(buildingsData) ? buildingsData.find(b => b.name === building) : null;
    const preferredFloorName = buildingMeta?.default_floor ?? null;
    if (preferredFloorName) {
        const preferred = floors.find(b => b.floor === preferredFloorName);
        if (preferred) return preferred;
    }

    const f = floors.find(b => b.floor === 'F');
    if (f) return f;

    const zero = floors.find(b => b.floor === '0');
    if (zero) return zero;

    return floors.reduce((min, cur) => (Number(cur.id) < Number(min.id) ? cur : min), floors[0]);
}

function chooseNavigationStartFloorForBuilding(building) {
    if (!building || !isNavigating()) return null;

    const segments = Array.isArray(navigationState.segments) ? navigationState.segments : [];
    for (let i = 0; i < segments.length; i++) {
        const segmentIds = segments[i];
        const firstId = Array.isArray(segmentIds) && segmentIds.length ? segmentIds[0] : null;
        const firstNode = firstId != null ? findNodeById(firstId) : null;
        if (!firstNode) continue;
        if (firstNode.building !== building) continue;

        const floorEntry = findFloorByBuildingAndFloor(firstNode.building, firstNode.floor);
        if (floorEntry) return floorEntry;
    }

    return null;
}

function chooseFloorForBuildingSelection(building) {
    return chooseNavigationStartFloorForBuilding(building) || chooseDefaultFloorForBuilding(building);
}

function getNavigationStepIndexForFloorEntry(floorEntry) {
    if (!floorEntry || !isNavigating()) return null;

    const segments = Array.isArray(navigationState.segments) ? navigationState.segments : [];
    const matches = [];

    for (let i = 0; i < segments.length; i++) {
        const segmentIds = segments[i];
        const firstId = Array.isArray(segmentIds) && segmentIds.length ? segmentIds[0] : null;
        const firstNode = firstId != null ? findNodeById(firstId) : null;
        if (!firstNode) continue;
        if (firstNode.building === floorEntry.building && firstNode.floor === floorEntry.floor) {
            matches.push(i);
        }
    }

    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];

    const currentStep = navigationState.currentStep ?? 0;
    let best = matches[0];
    let bestDist = Math.abs(best - currentStep);
    for (const idx of matches) {
        const dist = Math.abs(idx - currentStep);
        if (dist < bestDist) {
            best = idx;
            bestDist = dist;
        }
    }
    return best;
}

async function applyFloorSelection(floorEntry) {
    if (!floorEntry?.id) return;

    if (isNavigating()) {
        const stepIndex = getNavigationStepIndexForFloorEntry(floorEntry);
        if (stepIndex != null) {
            await showNavigationStep(stepIndex);
            return;
        }

        exitNavigationMode();
    }

    setCurrentFloorById(floorEntry.id);
    await redrawCanvas();
}

window.applyFloorSelection = applyFloorSelection;

