const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const sidebar = document.getElementById('sidebar');
const menuToggle = document.getElementById('menuToggle');
const searchArrow = document.getElementById('searchArrow');
const prevArrow = document.getElementById('prevArrow');
const nextArrow = document.getElementById('nextArrow');
const doorButton = document.getElementById('doorButton');
const doorArrow = document.getElementById('doorArrow');
const mapArrow = document.getElementById('mapArrow');
const doorModal = document.getElementById('doorModal');
const doorList = document.getElementById('doorList');
const searchButton = document.getElementById('searchButton');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');
const returnButton = document.getElementById('returnButton');
const roomSearchModal = document.getElementById('roomSearchModal');
const roomSearchInput = document.getElementById('roomSearchInput');
const roomSearchList = document.getElementById('roomSearchList');
const roomSearchHint = document.getElementById('roomSearchHint');

// Optional map selectors (present on index.html + dev.html)
const buildingSelectorBtn = document.getElementById('buildingSelector');
const floorSelectorBtn = document.getElementById('floorSelector');
const buildingModal = document.getElementById('buildingModal');
const buildingList = document.getElementById('buildingList');
const buildingSearch = document.getElementById('buildingSearch');
const floorModal = document.getElementById('floorModal');
const floorList = document.getElementById('floorList');
const floorSearch = document.getElementById('floorSearch');
const floorQuickButtons = document.getElementById('floorQuickButtons');

// Check if sidebar is currently visible
function isSidebarVisible() {
    const isCompact = window.innerWidth <= 768 || window.innerHeight <= 600;
    if (isCompact) {
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
    const prevEnabled = prevButton && !prevButton.disabled;
    const nextEnabled = nextButton && !nextButton.disabled;
    const hasMultipleDoors = navigationState.availableDoors?.length > 1;
    const doorEnabled = navigationState.currentStep >= 0 && hasMultipleDoors;
    const prevVisible = isNavigating;

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

    // Previous arrow - visible when navigating and not on campus map step
    if (prevArrow) {
        if (sidebarHidden && prevVisible) {
            prevArrow.classList.add('visible');
            if (prevEnabled) {
                prevArrow.classList.remove('disabled');
                prevArrow.disabled = false;
            } else {
                prevArrow.classList.add('disabled');
                prevArrow.disabled = true;
            }
        } else {
            prevArrow.classList.remove('visible');
            prevArrow.classList.remove('disabled');
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
    const isCompact = window.innerWidth <= 768 || window.innerHeight <= 600;
    if (isCompact) {
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
    const isCompact = window.innerWidth <= 768 || window.innerHeight <= 600;
    if (isCompact && sidebar.classList.contains('open')) {
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

// Previous arrow click handler
if (prevArrow) {
    prevArrow.addEventListener('click', () => {
        if (!prevArrow.disabled && prevButton && !prevButton.disabled) {
            prevButton.click();
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

        const baseName = door.node.room_name || `Bejárat ${index + 1}`;
        const floor = door.node.floor ?? '?';
        const doorName = `${baseName} (emelet: ${floor})`;
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

async function selectDoor(doorIndex) {
    if (!navigationState.availableDoors || doorIndex >= navigationState.availableDoors.length) return;

    navigationState.currentDoorIndex = doorIndex;
    const selectedDoor = navigationState.availableDoors[doorIndex];
    const segments = dividePathIntoSegments(selectedDoor.path);

    navigationState.segments = segments;
    await showNavigationStep(0);
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

if (prevButton) {
    prevButton.addEventListener('click', async () => {
        if (prevButton.disabled) return;
        closeSidebarOnMobile();
        await showNavigationStep(navigationState.currentStep - 1);
    });
}

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

    const f = floors.find(b => b.floor === 'F');
    if (f) return f;

    const zero = floors.find(b => b.floor === '0');
    if (zero) return zero;

    return floors.reduce((min, cur) => (Number(cur.id) < Number(min.id) ? cur : min), floors[0]);
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

function applyModalSearchFilter(listEl, query, getText) {
    if (!listEl) return;
    const normalizedQuery = (query || '').trim().toLowerCase();
    Array.from(listEl.children).forEach(li => {
        const haystack = (getText(li) || '').toLowerCase();
        li.style.display = normalizedQuery === '' || haystack.includes(normalizedQuery) ? '' : 'none';
    });
    updateTopMatch(listEl);
}

function updateTopMatch(listEl) {
    if (!listEl) return;
    Array.from(listEl.children).forEach(li => li.classList.remove('top-match'));
    const firstVisible = Array.from(listEl.children).find(li => li.style.display !== 'none');
    if (firstVisible) firstVisible.classList.add('top-match');
}

function getVisibleModalItems(listEl) {
    if (!listEl) return [];
    return Array.from(listEl.children).filter(li => li.style.display !== 'none');
}

function getSelectedVisibleIndex(listEl) {
    const visible = getVisibleModalItems(listEl);
    if (visible.length === 0) return -1;
    const idx = visible.findIndex(li => li.classList.contains('top-match'));
    return idx >= 0 ? idx : 0;
}

function setSelectedVisibleIndex(listEl, visibleIndex) {
    const visible = getVisibleModalItems(listEl);
    if (visible.length === 0) return;
    const clamped = Math.max(0, Math.min(visible.length - 1, visibleIndex));

    Array.from(listEl.children).forEach(li => li.classList.remove('top-match'));
    const selected = visible[clamped];
    selected.classList.add('top-match');
    selected.scrollIntoView({ block: 'nearest' });
}

function openBuildingSelectorModal() {
    if (!buildingModal || !buildingList) return;

    buildingList.innerHTML = '';
    if (buildingSearch) buildingSearch.value = '';

    const byBuilding = new Map();
    floorsData.forEach(b => {
        if (b.building === 'KAMPUSZ') return;
        if (!byBuilding.has(b.building)) byBuilding.set(b.building, []);
        byBuilding.get(b.building).push(b);
    });

    const buildings = Array.from(byBuilding.entries())
        .map(([building, floors]) => ({ building, floors }))
        .sort((a, b) => a.building.localeCompare(b.building, 'hu'));

    buildings.forEach(({ building, floors }) => {
        const li = document.createElement('li');
        li.className = 'building-item';
        li.setAttribute('data-building', building);
        if (currentFloor?.building === building) {
            li.classList.add('current');
        }

        const nameDiv = document.createElement('div');
        nameDiv.className = 'building-name';
        nameDiv.textContent = building;

        const fileDiv = document.createElement('div');
        fileDiv.className = 'building-file';
        const floorNames = sortFloorsById(floors.slice()).map(f => f.floor);
        const preview = floorNames.length > 8 ? `${floorNames.slice(0, 8).join(', ')}, ...` : floorNames.join(', ');
        fileDiv.textContent = preview;

        li.appendChild(nameDiv);
        li.appendChild(fileDiv);

        li.addEventListener('click', async () => {
            const defaultFloor = chooseDefaultFloorForBuilding(building);
            if (defaultFloor) {
                await applyFloorSelection(defaultFloor);
            }
            buildingModal.style.display = 'none';
        });

        buildingList.appendChild(li);
    });

    buildingModal.style.display = 'block';
    updateTopMatch(buildingList);
    if (buildingSearch) buildingSearch.focus();
}

function openFloorSelectorModal() {
    if (!floorModal || !floorList) return;
    if (!currentFloor?.building || isCampusFloor(currentFloor)) return;

    floorList.innerHTML = '';
    if (floorSearch) floorSearch.value = '';

    const floors = sortFloorsById(getBuildingFloors(currentFloor.building));
    floors.forEach(floor => {
        const li = document.createElement('li');
        li.className = 'building-item';
        li.setAttribute('data-floor-id', floor.id);
        if (floor.id === currentFloor?.id) {
            li.classList.add('current');
        }

        const nameDiv = document.createElement('div');
        nameDiv.className = 'building-name';
        nameDiv.textContent = floor.floor;

        const fileDiv = document.createElement('div');
        fileDiv.className = 'building-file';
        fileDiv.textContent = floor.filename;

        li.appendChild(nameDiv);
        li.appendChild(fileDiv);

        li.addEventListener('click', async () => {
            await applyFloorSelection(floor);
            floorModal.style.display = 'none';
        });

        floorList.appendChild(li);
    });

    floorModal.style.display = 'block';
    updateTopMatch(floorList);
    if (floorSearch) floorSearch.focus();
}

function updateFloorControls() {
    if (floorSelectorBtn) {
        const disabled = !currentFloor?.building || isCampusFloor(currentFloor);
        floorSelectorBtn.disabled = disabled;
        floorSelectorBtn.className = disabled ? 'disabled' : 'primary btn-success';
    }

    if (!floorQuickButtons) return;
    floorQuickButtons.innerHTML = '';

    if (!currentFloor?.building || isCampusFloor(currentFloor)) return;

    const floors = sortFloorsById(getBuildingFloors(currentFloor.building));
    const idx = floors.findIndex(f => f.id === currentFloor?.id);
    if (idx < 0) return;

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'floor-control-btn';
    upBtn.setAttribute('aria-label', 'Szint fel');
    upBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l-7 7h4v9h6v-9h4z"/></svg>';
    upBtn.disabled = idx >= floors.length - 1;
    upBtn.addEventListener('click', async () => {
        if (upBtn.disabled) return;
        await applyFloorSelection(floors[idx + 1]);
    });

    const indicatorBtn = document.createElement('button');
    indicatorBtn.type = 'button';
    indicatorBtn.className = 'floor-control-btn indicator';
    indicatorBtn.setAttribute('aria-label', 'Szint vÄ‚Ë‡lasztÄ‚Ĺ‚');
    indicatorBtn.textContent = currentFloor.floor ?? '?';
    indicatorBtn.addEventListener('click', () => openFloorSelectorModal());

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'floor-control-btn';
    downBtn.setAttribute('aria-label', 'Szint le');
    downBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20l7-7h-4V4H9v9H5z"/></svg>';
    downBtn.disabled = idx <= 0;
    downBtn.addEventListener('click', async () => {
        if (downBtn.disabled) return;
        await applyFloorSelection(floors[idx - 1]);
    });

    floorQuickButtons.appendChild(upBtn);
    floorQuickButtons.appendChild(indicatorBtn);
    floorQuickButtons.appendChild(downBtn);
}

// Keep floor UI in sync with floor changes
window.onCurrentFloorChanged = function() {
    updateFloorControls();
};
updateFloorControls();

if (buildingSelectorBtn) {
    buildingSelectorBtn.addEventListener('click', () => {
        openBuildingSelectorModal();
    });
}

if (floorSelectorBtn) {
    floorSelectorBtn.addEventListener('click', () => {
        if (floorSelectorBtn.disabled) return;
        openFloorSelectorModal();
    });
}

if (buildingSearch && buildingList) {
    buildingSearch.addEventListener('input', () => {
        applyModalSearchFilter(buildingList, buildingSearch.value, (li) => li.getAttribute('data-building') || '');
    });
    buildingSearch.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const idx = getSelectedVisibleIndex(buildingList);
            if (idx >= 0) setSelectedVisibleIndex(buildingList, idx + 1);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const idx = getSelectedVisibleIndex(buildingList);
            if (idx >= 0) setSelectedVisibleIndex(buildingList, idx - 1);
            return;
        }
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const visible = getVisibleModalItems(buildingList);
        const idx = getSelectedVisibleIndex(buildingList);
        const selected = idx >= 0 ? visible[idx] : null;
        if (selected) selected.click();
    });
}

if (floorSearch && floorList) {
    floorSearch.addEventListener('input', () => {
        applyModalSearchFilter(floorList, floorSearch.value, (li) => li.querySelector('.building-name')?.textContent || '');
    });
    floorSearch.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const idx = getSelectedVisibleIndex(floorList);
            if (idx >= 0) setSelectedVisibleIndex(floorList, idx + 1);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const idx = getSelectedVisibleIndex(floorList);
            if (idx >= 0) setSelectedVisibleIndex(floorList, idx - 1);
            return;
        }
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const visible = getVisibleModalItems(floorList);
        const idx = getSelectedVisibleIndex(floorList);
        const selected = idx >= 0 ? visible[idx] : null;
        if (selected) selected.click();
    });
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

function ensureImageLoaded(filename) {
    return new Promise((resolve) => {
        if (imageCache.has(filename)) {
            resolve(imageCache.get(filename));
            return;
        }

        const img = new Image();
        img.src = filename;
        img.onload = () => {
            imageCache.set(filename, img);
            resolve(img);
        };
    });
}

function computeBaseDrawDimensions(img) {
    const imgAspect = img.width / img.height;
    const canvasAspect = canvas.width / canvas.height;

    if (imgAspect > canvasAspect) {
        const drawWidth = canvas.width;
        const drawHeight = canvas.width / imgAspect;
        return { drawWidth, drawHeight };
    }

    const drawHeight = canvas.height;
    const drawWidth = canvas.height * imgAspect;
    return { drawWidth, drawHeight };
}

function getPixelPerfectZoom(img) {
    const base = computeBaseDrawDimensions(img);
    if (!base.drawWidth) return 1;
    return img.width / base.drawWidth;
}

function setViewToImagePoint(img, imgX, imgY, desiredZoom) {
    if (!img || !img.width || !img.height) return;
    if (imgX == null || imgY == null) return;

    const base = computeBaseDrawDimensions(img);
    const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, desiredZoom));
    zoomLevel = nextZoom;

    const drawWidth = base.drawWidth * zoomLevel;
    const drawHeight = base.drawHeight * zoomLevel;

    const desiredDrawX = (canvas.width / 2) - (imgX / img.width) * drawWidth;
    const desiredDrawY = (canvas.height / 2) - (imgY / img.height) * drawHeight;

    offsetX = desiredDrawX - (canvas.width - drawWidth) / 2;
    offsetY = desiredDrawY - (canvas.height - drawHeight) / 2;
}

async function focusViewOnCurrentFloorPoint(imgX, imgY, options = {}) {
    const filename = getCurrentFloorFilename();
    const img = await ensureImageLoaded(filename);
    const desiredZoom = options.pixelPerfect ? getPixelPerfectZoom(img) : (options.zoomLevel ?? zoomLevel);
    setViewToImagePoint(img, imgX, imgY, desiredZoom);
    await redrawCanvas();
}

async function showNavigationStep(stepIndex) {
    const segments = Array.isArray(navigationState?.segments) ? navigationState.segments : [];
    const maxStep = segments.length - 1;

    let targetStep = stepIndex;
    if (targetStep < -1) targetStep = -1;
    if (targetStep > maxStep) targetStep = maxStep;

    navigationState.currentStep = targetStep;

    if (targetStep === -1) {
        currentMarker = null;
        currentPath = null;

        if (campusFloorId) {
            setCurrentFloorById(campusFloorId);
        } else {
            const campusFloor = getDefaultCampusFloor();
            if (campusFloor?.id) setCurrentFloorById(campusFloor.id);
        }

        const roomData = navigationState?.roomData;
        const buildingMarker = roomData ? findFloorByBuildingAndFloor(roomData.building, roomData.floor) : null;
        if (buildingMarker && buildingMarker.x && buildingMarker.y) {
            await focusViewOnCurrentFloorPoint(buildingMarker.x, buildingMarker.y, { zoomLevel: 2.5 });
        } else {
            await redrawCanvas();
        }
    } else {
        const segmentIds = segments[targetStep] || [];
        const isLastSegment = targetStep === maxStep;

        const firstNode = segmentIds.length ? findNodeById(segmentIds[0]) : null;
        if (!firstNode) {
            await redrawCanvas();
        } else {
            const floorEntry = findFloorByBuildingAndFloor(firstNode.building, firstNode.floor);
            if (floorEntry?.id) {
                setCurrentFloorById(floorEntry.id);
            }

            currentPath = segmentIds;
            const roomX = isLastSegment ? navigationState.roomData?.x : null;
            const roomY = isLastSegment ? navigationState.roomData?.y : null;
            currentMarker = (isLastSegment && roomX && roomY) ? { x: roomX, y: roomY } : null;

            if (firstNode.x && firstNode.y) {
                await focusViewOnCurrentFloorPoint(firstNode.x, firstNode.y, { pixelPerfect: true });
            } else {
                await redrawCanvas();
            }
        }
    }

    const nextDisabled = segments.length === 0 || targetStep >= maxStep;
    if (nextButton) {
        nextButton.disabled = nextDisabled;
        nextButton.className = nextDisabled ? 'disabled' : 'primary';
    }

    const prevDisabled = segments.length === 0 || targetStep < 0;
    if (prevButton) {
        prevButton.disabled = prevDisabled;
        prevButton.className = prevDisabled ? 'disabled' : 'primary';
    }

    updateNextArrowVisibility();
    updateDoorButtonVisibility();
    updateReturnButtonState();
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
        const floorEntry = findFloorByBuildingAndFloor(navigationState.roomData.building, navigationState.roomData.floor);
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

// Function to divide path IDs into segments based on building/floor
function dividePathIntoSegments(pathIds) {
    if (!pathIds || pathIds.length === 0) return [];
    
    const segments = [];
    let currentSegment = [];
    let currentBuilding = null;
    let currentFloor = null;
    
    for (const id of pathIds) {
        const node = findNodeById(id);
        if (!node) continue;
        
        // Check if we need to start a new segment
        if (currentBuilding !== node.building || currentFloor !== node.floor) {
            // Save the current segment if it has items
            if (currentSegment.length > 0) {
                segments.push(currentSegment);
            }
            // Start a new segment
            currentSegment = [id];
            currentBuilding = node.building;
            currentFloor = node.floor;
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

    function toCanvasPoint(p) {
        return {
            x: lastDrawnImage.drawX + (p.x / lastDrawnImage.img.width) * lastDrawnImage.drawWidth,
            y: lastDrawnImage.drawY + (p.y / lastDrawnImage.img.height) * lastDrawnImage.drawHeight
        };
    }

    function drawArrowhead(fromX, fromY, toX, toY) {
        const dx = toX - fromX;
        const dy = toY - fromY;
        const len = Math.hypot(dx, dy);
        if (!len) return;

        const minLen = 40 * scale;
        if (len < minLen) return;

        const ux = dx / len;
        const uy = dy / len;

        const size = 16 * scale;
        const halfWidth = 8 * scale;

        // Place arrow slightly before the end to avoid overlapping the endpoint dot/marker
        const tipX = fromX + dx * 0.72;
        const tipY = fromY + dy * 0.72;
        const baseX = tipX - ux * size;
        const baseY = tipY - uy * size;

        const px = -uy;
        const py = ux;
        const leftX = baseX + px * halfWidth;
        const leftY = baseY + py * halfWidth;
        const rightX = baseX - px * halfWidth;
        const rightY = baseY - py * halfWidth;

        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
        ctx.lineWidth = 3 * scale;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(leftX, leftY);
        ctx.lineTo(rightX, rightY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    function drawStartMarker(canvasX, canvasY, marker) {
        const type = marker?.type || 'door';
        if (type === 'stairs') {
            const direction = marker?.direction === 'down' ? 'down' : 'up';
            drawStairsMarker(canvasX, canvasY, direction);
            return;
        }

        // Default: door in green circle
        const radius = 32 * scale;
        const iconSize = 42 * scale;

        ctx.save();
        ctx.fillStyle = 'rgba(40, 167, 69, 0.95)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 4 * scale;
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        const iconKey = 'door.svg';
        const cached = iconCache.get(iconKey);
        if (cached?.loaded && cached.img) {
            ctx.drawImage(
                cached.img,
                canvasX - iconSize / 2,
                canvasY - iconSize / 2,
                iconSize,
                iconSize
            );
            return;
        }

        if (!cached) {
            const img = new Image();
            iconCache.set(iconKey, { img, loaded: false });
            img.onload = () => {
                iconCache.set(iconKey, { img, loaded: true });
                redrawCanvas();
            };
            img.src = iconKey;
        }
    }

    function getFloorSortKeyForNode(node) {
        if (!node) return null;
        const floorEntry = findFloorByBuildingAndFloor(node.building, node.floor);
        if (floorEntry?.id) return floorEntry.id;

        const parsed = Number.parseInt(String(node.floor), 10);
        if (!Number.isNaN(parsed)) return parsed;
        return null;
    }

    function drawStairsMarker(canvasX, canvasY, direction) {
        const isUp = direction === 'up';
        const radius = 32 * scale;
        const iconSize = 46 * scale;
        const iconKey = isUp ? 'stairs-up.svg' : 'stairs-down.svg';

        ctx.save();
        ctx.fillStyle = isUp ? 'rgba(23, 162, 184, 0.92)' : 'rgba(253, 126, 20, 0.92)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 4 * scale;
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        const cached = iconCache.get(iconKey);
        if (cached?.loaded && cached.img) {
            ctx.drawImage(
                cached.img,
                canvasX - iconSize / 2,
                canvasY - iconSize / 2,
                iconSize,
                iconSize
            );
            return;
        }

        if (!cached) {
            const img = new Image();
            iconCache.set(iconKey, { img, loaded: false });
            img.onload = () => {
                iconCache.set(iconKey, { img, loaded: true });
                redrawCanvas();
            };
            img.src = iconKey;
        }
    }

    // Get coordinates for each node in the path
    for (const id of ids) {
        const node = findNodeById(id);
        if (node && node.x && node.y) {
            coordinates.push({
                x: node.x,
                y: node.y
            });
        }
    }

    // Determine if this segment ends with a floor change (stairs between layers)
    const hasNextSegment = !isLastSegment && navigationState?.currentStep != null &&
        navigationState.currentStep >= 0 &&
        Array.isArray(navigationState.segments) &&
        navigationState.currentStep < navigationState.segments.length - 1;

    let stairsIndicator = null;
    if (hasNextSegment) {
        const lastId = ids[ids.length - 1];
        const nextIds = navigationState.segments[navigationState.currentStep + 1];
        const nextFirstId = Array.isArray(nextIds) && nextIds.length ? nextIds[0] : null;

        const lastNode = findNodeById(lastId);
        const nextNode = findNodeById(nextFirstId);

        if (lastNode && nextNode && lastNode.building === nextNode.building && lastNode.floor !== nextNode.floor) {
            const currentKey = getFloorSortKeyForNode(lastNode);
            const nextKey = getFloorSortKeyForNode(nextNode);
            const direction = (nextKey != null && currentKey != null && nextKey > currentKey) ? 'up' : 'down';

            if (lastNode.x && lastNode.y) {
                const p = toCanvasPoint({ x: lastNode.x, y: lastNode.y });
                stairsIndicator = { x: p.x, y: p.y, direction };
            }
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
        let startMarkerPoint = null;
        // Draw each segment with alternating colors
        for (let i = 0; i < coordinates.length - 1; i++) {
            // Convert coordinates to canvas coordinates
            const start = toCanvasPoint(coordinates[i]);
            const end = toCanvasPoint(coordinates[i + 1]);
            const startX = start.x;
            const startY = start.y;
            const endX = end.x;
            const endY = end.y;

            if (i == 0) {
                startMarkerPoint = { x: startX, y: startY };
            } else if (i === coordinates.length - 2 && !isLastSegment && !stairsIndicator) {
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
            ctx.lineWidth = 6 * scale;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            // Direction indicator
            drawArrowhead(startX, startY, endX, endY);
        }

        // Stairs indicator at floor transitions (between segments)
        if (stairsIndicator) {
            drawStairsMarker(stairsIndicator.x, stairsIndicator.y, stairsIndicator.direction);
        }

        // Draw start marker last so it sits on top of the path.
        if (startMarkerPoint) {
            let startMarker = { type: 'door' };

            const stepIndex = navigationState?.currentStep ?? 0;
            if (stepIndex > 0) {
                const currentFirstNode = findNodeById(ids[0]);
                const prevIds = Array.isArray(navigationState.segments) ? navigationState.segments[stepIndex - 1] : null;
                const prevLastId = Array.isArray(prevIds) && prevIds.length ? prevIds[prevIds.length - 1] : null;
                const prevLastNode = findNodeById(prevLastId);

                const currentKey = getFloorSortKeyForNode(currentFirstNode);
                const prevKey = getFloorSortKeyForNode(prevLastNode);
                const direction = (currentKey != null && prevKey != null && currentKey > prevKey) ? 'up' : 'down';
                startMarker = { type: 'stairs', direction };
            }

            drawStartMarker(startMarkerPoint.x, startMarkerPoint.y, startMarker);
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
    return !!node && String(node.node_type) === '1' && !!node.room_name;
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

async function startNavigationToRoom(roomData) {
    if (!roomData) return;

    // Find shortest path using buildingGraph - find ALL doors
    const visited = new Set();
    const q = new PriorityQueue((a, b) => a.distance < b.distance);
    const allDoorsFound = [];
    let firstDoorPath = null;

    q.push({ node: roomData, distance: 0, path: [] });
    visited.add(roomData.id);

    while (!q.isEmpty()) {
        const node = q.pop();

        if (String(node.node.node_type) === '2') {
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

    // Divide the path into segments by building/floor
    const segments = dividePathIntoSegments(firstDoorPath || []);

    // Initialize navigation state
    navigationState = {
        segments: segments,
        currentStep: -1,
        roomData: roomData,
        availableDoors: allDoorsFound,
        currentDoorIndex: 0
    };

    currentMarker = null;
    currentPath = null;
    await showNavigationStep(-1);
}

function createVirtualList(scrollElOrContainerEl, contentElOrRowHeight, rowHeightOrRenderItem, renderItemOrOnItemClick, onItemClick) {
    const usingLegacySignature = typeof contentElOrRowHeight === 'number';
    const scrollEl = scrollElOrContainerEl;
    const contentEl = usingLegacySignature ? scrollElOrContainerEl : contentElOrRowHeight;
    const rowHeight = usingLegacySignature ? contentElOrRowHeight : rowHeightOrRenderItem;
    const renderItem = usingLegacySignature ? rowHeightOrRenderItem : renderItemOrOnItemClick;
    const onClick = usingLegacySignature ? renderItemOrOnItemClick : onItemClick;

    const spacer = document.createElement('div');
    spacer.className = 'virtual-list-spacer';
    contentEl.innerHTML = '';
    contentEl.appendChild(spacer);

    let items = [];
    let selectedIndex = -1;

    const pool = [];
    const buffer = 6;

    function getListOffsetInScrollEl() {
        if (scrollEl === contentEl) return 0;
        const scrollRect = scrollEl.getBoundingClientRect();
        const contentRect = contentEl.getBoundingClientRect();
        return (contentRect.top - scrollRect.top) + scrollEl.scrollTop;
    }

    function ensureIndexVisibleInternal(index) {
        if (index < 0 || index >= items.length) return;
        const listOffset = getListOffsetInScrollEl();
        const itemTop = listOffset + index * rowHeight;
        const itemBottom = itemTop + rowHeight;
        const viewportTop = scrollEl.scrollTop;
        const viewportBottom = viewportTop + (scrollEl.clientHeight || 0);

        const padding = 12;
        if (itemTop < viewportTop + padding) {
            scrollEl.scrollTop = Math.max(0, itemTop - padding);
            render();
            return;
        }
        if (itemBottom > viewportBottom - padding) {
            scrollEl.scrollTop = Math.max(0, itemBottom - (scrollEl.clientHeight || 0) + padding);
            render();
        }
    }

    function render() {
        const scrollTop = scrollEl.scrollTop;
        const viewportHeight = scrollEl.clientHeight || 0;
        const listOffset = getListOffsetInScrollEl();
        const listScrollTop = Math.max(0, scrollTop - listOffset);
        const listViewportTop = Math.max(0, listOffset - scrollTop);
        const listViewportHeight = Math.max(0, viewportHeight - listViewportTop);

        const startIndex = Math.max(0, Math.floor(listScrollTop / rowHeight) - buffer);
        const visibleCount = Math.ceil(listViewportHeight / rowHeight) + buffer * 2;
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
                onClick(itemIndex, item);
            };
            renderItem(el, item, itemIndex);
        }
    }

    scrollEl.addEventListener('scroll', render);
    window.addEventListener('resize', render);

    return {
        setItems(newItems, nextSelectedIndex = -1) {
            items = Array.isArray(newItems) ? newItems : [];
            selectedIndex = nextSelectedIndex;
            spacer.style.height = `${items.length * rowHeight}px`;
            scrollEl.scrollTop = 0;
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
            const listOffset = getListOffsetInScrollEl();
            scrollEl.scrollTop = listOffset + index * rowHeight;
            render();
        },
        ensureIndexVisible(index) {
            ensureIndexVisibleInternal(index);
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
    roomSearchList.style.height = '';
    return;
}

const floorSortIdCache = new Map();

function getFloorSortIdForRoom(room) {
    const building = room?.building || '';
    const floor = room?.floor ?? '';
    const key = `${building}|${floor}`;
    if (floorSortIdCache.has(key)) return floorSortIdCache.get(key);

    const floorEntry = findFloorByBuildingAndFloor(building, floor);
    const floorId = floorEntry?.id != null ? Number(floorEntry.id) : Number.POSITIVE_INFINITY;
    const safeFloorId = Number.isFinite(floorId) ? floorId : Number.POSITIVE_INFINITY;
    floorSortIdCache.set(key, safeFloorId);
    return safeFloorId;
}

function formatRoomMeta(room) {
    const building = room?.building || '?';
    const floor = room?.floor ?? '?';
    return `${building} - ${floor}`;
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

    el._nameEl.textContent = room?.room_name || '';
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
        const modalContentEl = roomSearchModal.querySelector('.modal-content');
        if (!modalContentEl) return;
        roomSearchUI.virtualList = createVirtualList(
            modalContentEl,
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
        const key = room.room_name_searchKey || '';
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
            const buildingCmp = a.building.localeCompare(b.building, 'hu');
            if (buildingCmp !== 0) return buildingCmp;

            const floorIdA = getFloorSortIdForRoom(a);
            const floorIdB = getFloorSortIdForRoom(b);
            if (floorIdA !== floorIdB) return floorIdA - floorIdB;

            const roomCmp = a.room_name.localeCompare(b.room_name, 'hu');
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
    if (roomSearchInput) roomSearchInput.value = room.room_name || '';
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
            roomSearchUI.virtualList.ensureIndexVisible(next);
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const next = selected < 0 ? 0 : Math.max(0, selected - 1);
            roomSearchUI.virtualList.setSelectedIndex(next);
            roomSearchUI.virtualList.ensureIndexVisible(next);
        }
    });
}

// Button event listeners
searchButton.addEventListener('click', async () => {
    closeSidebarOnMobile();
    openRoomSearchModal();
});

nextButton.addEventListener('click', async () => {
    if (nextButton.disabled || navigationState.currentStep >= navigationState.segments.length) return;

    closeSidebarOnMobile();
    await showNavigationStep(navigationState.currentStep + 1);
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

let fullscreenRequestInFlight = false;

function requestFullscreen() {
    if (isFullscreen() || fullscreenRequestInFlight) return;
    fullscreenRequestInFlight = true;

    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen()
            .catch(() => {})
            .finally(() => { fullscreenRequestInFlight = false; });
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
        setTimeout(() => { fullscreenRequestInFlight = false; }, 250);
    } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
        setTimeout(() => { fullscreenRequestInFlight = false; }, 250);
    } else {
        fullscreenRequestInFlight = false;
    }
}

function requestFullscreenFromUserGesture() {
    if (isMobile() && !isFullscreen()) requestFullscreen();
}

// Request fullscreen on touch (mobile only) - capture phase so it runs even if UI stops propagation.
document.addEventListener('touchend', requestFullscreenFromUserGesture, { passive: true, capture: true });

// Handle fullscreen change - resize canvas when entering/exiting fullscreen
document.addEventListener('fullscreenchange', () => {
    fullscreenRequestInFlight = false;
    updateCanvasSize();
    redrawCanvas();
});
document.addEventListener('webkitfullscreenchange', () => {
    fullscreenRequestInFlight = false;
    updateCanvasSize();
    redrawCanvas();
});

// Touch support for mobile
let touchStartX = 0;
let touchStartY = 0;
let lastTouchDistance = 0;

canvas.addEventListener('touchstart', (event) => {
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
    if (buildingModal && event.target === buildingModal) {
        buildingModal.style.display = 'none';
    }
    if (floorModal && event.target === floorModal) {
        floorModal.style.display = 'none';
    }
});

// Close modals when pressing Escape
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        if (doorModal) doorModal.style.display = 'none';
        if (roomSearchModal) roomSearchModal.style.display = 'none';
        if (buildingModal) buildingModal.style.display = 'none';
        if (floorModal) floorModal.style.display = 'none';
    }
});
