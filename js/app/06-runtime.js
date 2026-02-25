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

function openFeedbackModal() {
    if (!feedbackModal || !feedbackForm || !feedbackEmail || !feedbackText) return;
    feedbackModal.style.display = 'flex';
    if (feedbackError) feedbackError.style.display = 'none';
    if (feedbackSuccess) feedbackSuccess.style.display = 'none';
    feedbackForm.reset();
    setTimeout(() => feedbackEmail.focus(), 0);
}

function closeFeedbackModal() {
    if (!feedbackModal) return;
    feedbackModal.style.display = 'none';
}

function setFeedbackBusy(isBusy) {
    if (feedbackSubmit) feedbackSubmit.disabled = !!isBusy;
    if (feedbackEmail) feedbackEmail.disabled = !!isBusy;
    if (feedbackText) feedbackText.disabled = !!isBusy;
}

function showFeedbackError(message) {
    if (!feedbackError) return;
    feedbackError.textContent = message || '';
    feedbackError.style.display = '';
    if (feedbackSuccess) feedbackSuccess.style.display = 'none';
}

function showFeedbackSuccess(message) {
    if (!feedbackSuccess) return;
    feedbackSuccess.textContent = message || '';
    feedbackSuccess.style.display = '';
    if (feedbackError) feedbackError.style.display = 'none';
}

if (feedbackButton) {
    feedbackButton.addEventListener('click', () => {
        closeSidebarOnMobile();
        openFeedbackModal();
    });
}

if (feedbackForm) {
    feedbackForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!feedbackEmail || !feedbackText) return;

        const email = (feedbackEmail.value || '').trim();
        const message = (feedbackText.value || '').trim();

        if (!email || !message) {
            showFeedbackError('Kérlek add meg az e-mail címed és a visszajelzést.');
            return;
        }

        if (feedbackEmail.checkValidity && !feedbackEmail.checkValidity()) {
            showFeedbackError('Kérlek valós e-mail címet adj meg.');
            return;
        }

        setFeedbackBusy(true);
        try {
            const res = await API.sendFeedback(email, message);
            if (res && res.success) {
                showFeedbackSuccess('Köszönjük! A visszajelzést elküldtük.');
                feedbackForm.reset();
            } else {
                showFeedbackError((res && res.error) ? res.error : 'A visszajelzés elküldése nem sikerült.');
            }
        } catch (err) {
            console.error(err);
            showFeedbackError('A visszajelzés elküldése nem sikerült.');
        } finally {
            setFeedbackBusy(false);
        }
    });
}

window.addEventListener('resize', () => {
    // Ensure desktop layout doesn't keep the mobile "open" state around.
    if (sidebar && !window.BMEFind?.ui?.isMobilePlatform?.()) sidebar.classList.remove('open');

    updateCanvasSize();
    updateNextArrowVisibility();
    updateDoorButtonVisibility();
    requestRedrawCanvas();
});

// Fullscreen support for mobile
function isMobile() {
    return !!window.BMEFind?.ui?.isMobilePlatform?.();
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
let pinchState = null;
let touchTapCandidate = null;
let touchTapCancelled = false;
const TOUCH_TAP_SLOP_PX = 10;

function clientPointToCanvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
}

function canvasPointToImagePointUnsafe(canvasX, canvasY) {
    const img = lastDrawnImage?.img;
    if (!img || !img.width || !img.height) return null;
    if (!lastDrawnImage.drawWidth || !lastDrawnImage.drawHeight) return null;
    const relX = (canvasX - lastDrawnImage.drawX) / lastDrawnImage.drawWidth;
    const relY = (canvasY - lastDrawnImage.drawY) / lastDrawnImage.drawHeight;
    return { x: relX * img.width, y: relY * img.height };
}

canvas.addEventListener('touchstart', (event) => {
    if (event.touches.length === 1) {
        // Single touch - start panning
        const touch = event.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        pinchState = null;
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
        lastTouchDistance = 0;

        const img = lastDrawnImage?.img;
        if (!img || !img.width || !img.height || !zoomLevel) {
            pinchState = null;
            return;
        }

        const t1 = event.touches[0];
        const t2 = event.touches[1];
        const c1 = clientPointToCanvasPoint(t1.clientX, t1.clientY);
        const c2 = clientPointToCanvasPoint(t2.clientX, t2.clientY);
        const img1 = canvasPointToImagePointUnsafe(c1.x, c1.y);
        const img2 = canvasPointToImagePointUnsafe(c2.x, c2.y);
        if (!img1 || !img2) {
            pinchState = null;
            return;
        }

        pinchState = {
            img,
            touch1Id: t1.identifier,
            touch2Id: t2.identifier,
            img1,
            img2,
            baseDrawWidth: lastDrawnImage.drawWidth / zoomLevel,
            baseDrawHeight: lastDrawnImage.drawHeight / zoomLevel
        };
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
        if (!pinchState || !pinchState.img || !pinchState.baseDrawWidth || !pinchState.baseDrawHeight) return;

        const touches = Array.from(event.touches || []);
        const t1 = touches.find(t => t.identifier === pinchState.touch1Id) || touches[0];
        const t2 = touches.find(t => t.identifier === pinchState.touch2Id) || touches[1] || touches[0];
        if (!t1 || !t2 || t1.clientX == null || t1.clientY == null || t2.clientX == null || t2.clientY == null) return;

        const c1 = clientPointToCanvasPoint(t1.clientX, t1.clientY);
        const c2 = clientPointToCanvasPoint(t2.clientX, t2.clientY);

        const img = pinchState.img;
        const dImg = Math.hypot(pinchState.img2.x - pinchState.img1.x, pinchState.img2.y - pinchState.img1.y);
        if (!dImg) return;

        const baseScale = pinchState.baseDrawWidth / img.width;
        const dCan = Math.hypot(c2.x - c1.x, c2.y - c1.y);
        const desiredZoom = dCan / (baseScale * dImg);

        const oldZoom = zoomLevel;
        const maxZoom = (typeof getMaxZoomForImage === 'function') ? getMaxZoomForImage(img) : MIN_ZOOM;
        zoomLevel = Math.max(MIN_ZOOM, Math.min(maxZoom, desiredZoom));

        if (zoomLevel === MIN_ZOOM) {
            offsetX = 0;
            offsetY = 0;
            requestRedrawCanvas();
            return;
        }

        if (oldZoom === zoomLevel) return;

        const drawWidth = pinchState.baseDrawWidth * zoomLevel;
        const drawHeight = pinchState.baseDrawHeight * zoomLevel;

        const drawX1 = c1.x - (pinchState.img1.x / img.width) * drawWidth;
        const drawY1 = c1.y - (pinchState.img1.y / img.height) * drawHeight;
        const drawX2 = c2.x - (pinchState.img2.x / img.width) * drawWidth;
        const drawY2 = c2.y - (pinchState.img2.y / img.height) * drawHeight;

        const drawX = (drawX1 + drawX2) / 2;
        const drawY = (drawY1 + drawY2) / 2;

        offsetX = drawX - (canvas.width - drawWidth) / 2;
        offsetY = drawY - (canvas.height - drawHeight) / 2;

        requestRedrawCanvas();
    }
}, { passive: false });

canvas.addEventListener('touchend', async (event) => {
    isDragging = false;
    lastTouchDistance = 0;
    if (!event.touches || event.touches.length < 2) pinchState = null;

    if (event.touches && event.touches.length === 1) {
        touchTapCandidate = null;
        touchTapCancelled = true;

        if (zoomLevel > MIN_ZOOM) {
            const remaining = event.touches[0];
            isDragging = true;
            lastMouseX = remaining.clientX;
            lastMouseY = remaining.clientY;
        }
    }

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

    if (window.BMEFind?.dev?.doorCampusPick?.active && typeof isCampusMap === 'function' && isCampusMap()) {
        return;
    }

    if (typeof window.handleNavigationTapAtClientPoint === 'function') {
        const handledNavigation = await window.handleNavigationTapAtClientPoint(ended.clientX, ended.clientY);
        if (handledNavigation) return;
    }

    if (typeof window.selectCampusBuildingAtClientPoint === 'function') {
        await window.selectCampusBuildingAtClientPoint(ended.clientX, ended.clientY);
    }
});

canvas.addEventListener('touchcancel', () => {
    isDragging = false;
    lastTouchDistance = 0;
    pinchState = null;
    touchTapCandidate = null;
    touchTapCancelled = false;
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
    if (feedbackModal && event.target === feedbackModal) {
        feedbackModal.style.display = 'none';
    }
});

// Close modals when pressing Escape
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        if (doorModal) doorModal.style.display = 'none';
        if (roomSearchModal) roomSearchModal.style.display = 'none';
        if (buildingModal) buildingModal.style.display = 'none';
        if (floorModal) floorModal.style.display = 'none';
        if (feedbackModal) feedbackModal.style.display = 'none';
    }
});
