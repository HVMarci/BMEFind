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
	    requestRedrawCanvas();
	});

window.addEventListener('resize', () => {
    // Close mobile sidebar on resize to desktop
    if (window.innerWidth > 768 && sidebar) {
        sidebar.classList.remove('open');
    }

    updateCanvasSize();
    updateNextArrowVisibility();
    updateDoorButtonVisibility();
    requestRedrawCanvas();
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
    requestRedrawCanvas();
});
document.addEventListener('webkitfullscreenchange', () => {
    fullscreenRequestInFlight = false;
    updateCanvasSize();
    requestRedrawCanvas();
});

// Touch support for mobile
let touchStartX = 0;
let touchStartY = 0;
let lastTouchDistance = 0;
let touchTapCandidate = null;
let touchTapCancelled = false;
const TOUCH_TAP_SLOP_PX = 10;

canvas.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) {
        // Single touch - start panning
        const touch = event.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchTapCandidate = { identifier: touch.identifier, x: touch.clientX, y: touch.clientY };
        touchTapCancelled = false;

        if (zoomLevel > MIN_ZOOM) {
            isDragging = true;
            lastMouseX = touch.clientX;
            lastMouseY = touch.clientY;
        }
    } else if (event.touches.length === 2) {
        // Two finger touch - prepare for pinch zoom
        event.preventDefault();
        isDragging = false;
        touchTapCandidate = null;
        touchTapCancelled = true;
        const dx = event.touches[0].clientX - event.touches[1].clientX;
        const dy = event.touches[0].clientY - event.touches[1].clientY;
        lastTouchDistance = Math.sqrt(dx * dx + dy * dy);
    }
}, { passive: false });

canvas.addEventListener('touchmove', (event) => {
    if (event.touches.length === 1 && touchTapCandidate && !touchTapCancelled) {
        const touch = event.touches[0];
        const dx = touch.clientX - touchTapCandidate.x;
        const dy = touch.clientY - touchTapCandidate.y;
        if (Math.hypot(dx, dy) > TOUCH_TAP_SLOP_PX) touchTapCancelled = true;
    }

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

        requestRedrawCanvas();
    } else if (event.touches.length === 2) {
        // Pinch zoom
        event.preventDefault();
        touchTapCandidate = null;
        touchTapCancelled = true;
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

            requestRedrawCanvas();
        }

        lastTouchDistance = distance;
    }
}, { passive: false });

canvas.addEventListener('touchend', async (event) => {
    isDragging = false;
    lastTouchDistance = 0;

    if (!touchTapCandidate || touchTapCancelled) {
        touchTapCandidate = null;
        touchTapCancelled = false;
        return;
    }

    const ended = Array.from(event.changedTouches || []).find(t => t.identifier === touchTapCandidate.identifier) ||
        (event.changedTouches && event.changedTouches[0]);

    const shouldSelect = ended && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    touchTapCandidate = null;
    touchTapCancelled = false;

    if (!shouldSelect) return;

    if (typeof window.handleNavigationTapAtClientPoint === 'function') {
        const handledNavigation = await window.handleNavigationTapAtClientPoint(ended.clientX, ended.clientY);
        if (handledNavigation) return;
    }

    if (typeof window.selectCampusBuildingAtClientPoint === 'function') {
        await window.selectCampusBuildingAtClientPoint(ended.clientX, ended.clientY);
    }
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
