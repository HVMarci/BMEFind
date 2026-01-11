const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const sidebar = document.getElementById('sidebar');
const loadingOverlay = document.getElementById('loadingOverlay');
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

const feedbackButton = document.getElementById('feedbackButton');
const feedbackModal = document.getElementById('feedbackModal');
const feedbackForm = document.getElementById('feedbackForm');
const feedbackEmail = document.getElementById('feedbackEmail');
const feedbackText = document.getElementById('feedbackText');
const feedbackSubmit = document.getElementById('feedbackSubmit');
const feedbackError = document.getElementById('feedbackError');
const feedbackSuccess = document.getElementById('feedbackSuccess');

function setLoadingOverlayVisible(isVisible) {
    if (!loadingOverlay) return;
    loadingOverlay.classList.toggle('active', !!isVisible);
}

window.BMEFind = window.BMEFind || {};
window.BMEFind.setLoadingOverlayVisible = setLoadingOverlayVisible;

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
    requestRedrawCanvas();
}

// Close sidebar on mobile
function closeSidebarOnMobile() {
    const isCompact = window.innerWidth <= 768 || window.innerHeight <= 600;
    if (isCompact && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        updateCanvasSize();
        updateNextArrowVisibility();
        requestRedrawCanvas();
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
            <div class="door-distance">Távolság: ${Math.round(door.distance)} m</div>
        `;

        li.addEventListener('click', () => {
            selectDoor(index);
            doorModal.style.display = 'none';
        });

        doorList.appendChild(li);
    });

    doorModal.style.display = 'flex';
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

