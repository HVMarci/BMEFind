const imageLoadPromises = new Map();
const imageLoadFailures = new Set();

const loadingCounts = new Map();

function getTotalLoadingCount() {
    let sum = 0;
    for (const count of loadingCounts.values()) sum += count;
    return sum;
}

function isLoadingActive() {
    return getTotalLoadingCount() > 0;
}

function startLoading(reason) {
    const key = String(reason || 'loading');
    loadingCounts.set(key, (loadingCounts.get(key) || 0) + 1);
    if (window.BMEFind?.setLoadingOverlayVisible) {
        window.BMEFind.setLoadingOverlayVisible(true);
    }
}

function stopLoading(reason) {
    const key = String(reason || 'loading');
    const cur = loadingCounts.get(key) || 0;
    if (cur <= 1) loadingCounts.delete(key);
    else loadingCounts.set(key, cur - 1);
    if (!isLoadingActive() && window.BMEFind?.setLoadingOverlayVisible) {
        window.BMEFind.setLoadingOverlayVisible(false);
    }
}

window.BMEFind = window.BMEFind || {};
window.BMEFind.loading = {
    start: startLoading,
    stop: stopLoading,
    isActive: isLoadingActive
};

// Keep the overlay visible from the earliest possible JS moment,
// then release it once initialization completes.
startLoading('boot');

function loadImageForFilename(filename) {
    if (imageCache.has(filename)) return Promise.resolve(imageCache.get(filename));
    if (imageLoadFailures.has(filename)) return Promise.resolve(null);
    if (imageLoadPromises.has(filename)) return imageLoadPromises.get(filename);

    startLoading('image');

    const p = new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            imageCache.set(filename, img);
            resolve(img);
        };
        img.onerror = () => {
            imageLoadFailures.add(filename);
            resolve(null);
        };
        img.src = filename;
    });

    imageLoadPromises.set(filename, p);
    p.finally(() => {
        imageLoadPromises.delete(filename);
        stopLoading('image');
        requestRedrawCanvas();
    });

    return p;
}

function drawImage(filename) {
    if (imageCache.has(filename)) {
        const img = imageCache.get(filename);
        renderImage(img);
        return Promise.resolve(true);
    }

    loadImageForFilename(filename);
    return Promise.resolve(false);
}

async function ensureImageLoaded(filename) {
    if (imageCache.has(filename)) return imageCache.get(filename);
    return await loadImageForFilename(filename);
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

function getMaxZoomForImage(img) {
    if (!img || !img.width || !img.height) return MIN_ZOOM;
    return Math.max(1, getPixelPerfectZoom(img) * 3);
}

function setViewToImagePoint(img, imgX, imgY, desiredZoom) {
    if (!img || !img.width || !img.height) return;
    if (imgX == null || imgY == null) return;

    const base = computeBaseDrawDimensions(img);
    const maxZoom = getMaxZoomForImage(img);
    const nextZoom = Math.max(MIN_ZOOM, Math.min(maxZoom, desiredZoom));
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

function getSelectedNavigationDoorNode() {
    const idx = Number(navigationState?.currentDoorIndex ?? 0);
    const doors = navigationState?.availableDoors;
    if (!Array.isArray(doors) || doors.length === 0) return null;
    const entry = doors[idx] || doors[0];
    return entry?.node || null;
}

function getNavigationCampusMarkerPoint() {
    const doorNode = getSelectedNavigationDoorNode();
    const doorXRaw = doorNode?.campus_x;
    const doorYRaw = doorNode?.campus_y;
    if (doorXRaw !== null && doorXRaw !== undefined && doorYRaw !== null && doorYRaw !== undefined) {
        const doorX = Number(doorXRaw);
        const doorY = Number(doorYRaw);
        if (Number.isFinite(doorX) && Number.isFinite(doorY)) return { x: doorX, y: doorY };
    }

    const roomData = navigationState?.roomData;
    const floorEntry = roomData ? findFloorByBuildingAndFloor(roomData.building, roomData.floor) : null;
    const bxRaw = floorEntry?.x;
    const byRaw = floorEntry?.y;
    if (bxRaw !== null && bxRaw !== undefined && byRaw !== null && byRaw !== undefined) {
        const bx = Number(bxRaw);
        const by = Number(byRaw);
        if (Number.isFinite(bx) && Number.isFinite(by)) return { x: bx, y: by };
    }

    return null;
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

        const markerPoint = getNavigationCampusMarkerPoint();
        if (markerPoint) {
            await focusViewOnCurrentFloorPoint(markerPoint.x, markerPoint.y, { zoomLevel: 2.5 });
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
            if (isLastSegment && roomX !== null && roomX !== undefined && roomY !== null && roomY !== undefined) {
                const x = Number(roomX);
                const y = Number(roomY);
                currentMarker = (Number.isFinite(x) && Number.isFinite(y)) ? { x, y } : null;
            } else {
                currentMarker = null;
            }

            const firstXRaw = firstNode.x;
            const firstYRaw = firstNode.y;
            if (firstXRaw !== null && firstXRaw !== undefined && firstYRaw !== null && firstYRaw !== undefined) {
                const firstX = Number(firstXRaw);
                const firstY = Number(firstYRaw);
                if (Number.isFinite(firstX) && Number.isFinite(firstY)) {
                    await focusViewOnCurrentFloorPoint(firstX, firstY, { pixelPerfect: true });
                } else {
                    await redrawCanvas();
                }
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

function getPoiIconKeyForNode(node) {
    const t = String(node?.node_type ?? '');
    if (t === '3') return 'wc-ferfi.svg';
    if (t === '4') return 'wc-noi.svg';
    if (t === '5') return 'wc-mozgasserult.svg';
    if (t === '6') return 'mikro.svg';
    return null;
}

function drawCachedIcon(iconKey, canvasX, canvasY, iconSize) {
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
            requestRedrawCanvas();
        };
        img.src = iconKey;
    }
}

function drawPoiMarkers() {
    if (!lastDrawnImage.img) return;
    if (!currentFloor?.building || !currentFloor?.floor) return;
    if (typeof isCampusMap === 'function' && isCampusMap()) return;
    if (!Array.isArray(nodeData) || nodeData.length === 0) return;

    const scale = getImageScale();
    const iconSize = 54 * scale;

    for (const node of nodeData) {
        if (node.building !== currentFloor.building || node.floor !== currentFloor.floor) continue;

        const iconKey = getPoiIconKeyForNode(node);
        if (!iconKey) continue;

        const pt = imageToCanvasPoint(node.x, node.y);
        if (!pt) continue;

        drawCachedIcon(iconKey, pt.x, pt.y, iconSize);
    }
}

async function redrawCanvas() {
    if (redrawCanvas._inFlight) {
        redrawCanvas._needsAnotherPass = true;
        return redrawCanvas._inFlight;
    }

    redrawCanvas._inFlight = (async () => {
        do {
            redrawCanvas._needsAnotherPass = false;
            const didDrawImage = await drawImage(getCurrentFloorFilename());
            navigationTapTargets = [];

            if (!didDrawImage) {
                continue;
            }

            if (isCampusMap() && canvasHoverState?.kind === 'building' && Array.isArray(canvasHoverState.corners) && canvasHoverState.corners.length >= 3) {
                const pts = canvasHoverState.corners
                    .map(p => imageToCanvasPoint(p.x, p.y))
                    .filter(Boolean);

                if (pts.length >= 3) {
                    ctx.save();
                    ctx.fillStyle = 'rgba(0, 123, 255, 0.12)';
                    ctx.strokeStyle = 'rgba(0, 123, 255, 0.55)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                    ctx.restore();
                }
            }

            drawPoiMarkers();

            // Redraw markers and paths if they exist
            if (navigationState.currentStep === -1 && navigationState.roomData) {
                const markerPoint = getNavigationCampusMarkerPoint();
                if (markerPoint) {
                    drawBuildingMarker(markerPoint.x, markerPoint.y);

                    const pt = imageToCanvasPoint(markerPoint.x, markerPoint.y);
                    const scale = getImageScale();
                    if (pt && Number.isFinite(scale) && scale > 0) {
                        navigationTapTargets = [{ role: 'start', x: pt.x, y: pt.y, radius: 44 * scale }];
                    }
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

        } while (redrawCanvas._needsAnotherPass);
    })();

    try {
        await redrawCanvas._inFlight;
    } finally {
        redrawCanvas._inFlight = null;
    }
}

redrawCanvas._inFlight = null;
redrawCanvas._needsAnotherPass = false;

function requestRedrawCanvas() {
    if (requestRedrawCanvas._scheduled) return;
    requestRedrawCanvas._scheduled = true;

    window.requestAnimationFrame(() => {
        requestRedrawCanvas._scheduled = false;
        if (typeof window.redrawCanvas === 'function') {
            window.redrawCanvas();
            return;
        }
        redrawCanvas();
    });
}

requestRedrawCanvas._scheduled = false;
window.requestRedrawCanvas = requestRedrawCanvas;

function polygonArea(points) {
    if (!Array.isArray(points) || points.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        sum += (a.x * b.y) - (b.x * a.y);
    }
    return Math.abs(sum) / 2;
}

function isPointInPolygon(pt, polygon) {
    if (!pt || !Array.isArray(polygon) || polygon.length < 3) return false;

    // Ray casting algorithm
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x, yi = polygon[i].y;
        const xj = polygon[j].x, yj = polygon[j].y;

        const intersects = ((yi > pt.y) !== (yj > pt.y)) &&
            (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + 0.0) + xi);
        if (intersects) inside = !inside;
    }

    return inside;
}

function getCampusBuildingPolygons() {
    if (!Array.isArray(buildingsData)) return [];

    return buildingsData
        .filter(b => b && typeof b.name === 'string' && b.name.trim() !== '')
        .map(b => {
            const x1 = parseInt(b.x1, 10), y1 = parseInt(b.y1, 10);
            const x2 = parseInt(b.x2, 10), y2 = parseInt(b.y2, 10);
            const x3 = parseInt(b.x3, 10), y3 = parseInt(b.y3, 10);
            const x4 = parseInt(b.x4, 10), y4 = parseInt(b.y4, 10);

            const corners = [
                { x: x1, y: y1 },
                { x: x2, y: y2 },
                { x: x3, y: y3 },
                { x: x4, y: y4 }
            ];

            const cx = corners.reduce((s, p) => s + p.x, 0) / corners.length;
            const cy = corners.reduce((s, p) => s + p.y, 0) / corners.length;
            corners.sort((a, d) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(d.y - cy, d.x - cx));

            return { name: b.name, corners };
        })
        .filter(b => b.corners.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)));
}

async function selectCampusBuildingAtClientPoint(clientX, clientY) {
    if (!isCampusMap()) return false;

    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    const imgPt = canvasToImagePoint(canvasX, canvasY);
    if (!imgPt) return false;

    const candidates = getCampusBuildingPolygons();
    const hits = [];

    for (const b of candidates) {
        if (isPointInPolygon(imgPt, b.corners)) {
            hits.push({ name: b.name, area: polygonArea(b.corners) });
        }
    }

    if (hits.length === 0) return false;

    hits.sort((a, b) => a.area - b.area);
    const buildingName = hits[0].name;
    const targetFloor = chooseFloorForBuildingSelection(buildingName);
    if (!targetFloor) return false;

    await applyFloorSelection(targetFloor);
    return true;
}

window.selectCampusBuildingAtClientPoint = selectCampusBuildingAtClientPoint;

let navigationTapTargets = [];
let canvasHoverState = { kind: null, role: null, buildingName: null, corners: null };

async function handleNavigationTapAtClientPoint(clientX, clientY) {
    if (!isNavigating() || navigationState?.currentStep == null || navigationState.currentStep < -1) return false;
    if (navigationState.currentStep === -1 && !navigationState?.roomData) return false;
    if (!Array.isArray(navigationTapTargets) || navigationTapTargets.length === 0) return false;

    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    let best = null;
    let bestDist = Infinity;
    for (const t of navigationTapTargets) {
        if (!t || t.x == null || t.y == null || !Number.isFinite(t.radius)) continue;
        const d = Math.hypot(canvasX - t.x, canvasY - t.y);
        if (d <= t.radius && d < bestDist) {
            best = t;
            bestDist = d;
        }
    }

    if (!best) return false;
    if (typeof closeSidebarOnMobile === 'function') closeSidebarOnMobile();

    const step = navigationState.currentStep ?? 0;
    const maxStep = Array.isArray(navigationState.segments) ? navigationState.segments.length - 1 : -1;

    if (best.role === 'start' && step === -1 && maxStep >= 0) {
        await showNavigationStep(0);
        return true;
    }

    if (best.role === 'next' && step < maxStep) {
        await showNavigationStep(step + 1);
        return true;
    }

    if (best.role === 'prev' && step > 0) {
        await showNavigationStep(step - 1);
        return true;
    }

    return true;
}

window.handleNavigationTapAtClientPoint = handleNavigationTapAtClientPoint;

function getNavigationTapTargetAtClientPoint(clientX, clientY) {
    if (!isNavigating() || navigationState?.currentStep == null || navigationState.currentStep < -1) return null;
    if (navigationState.currentStep === -1 && !navigationState?.roomData) return null;
    if (!Array.isArray(navigationTapTargets) || navigationTapTargets.length === 0) return null;

    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    let best = null;
    let bestDist = Infinity;
    for (const t of navigationTapTargets) {
        if (!t || t.x == null || t.y == null || !Number.isFinite(t.radius)) continue;
        const d = Math.hypot(canvasX - t.x, canvasY - t.y);
        if (d <= t.radius && d < bestDist) {
            best = t;
            bestDist = d;
        }
    }

    return best;
}

function isClientPointOverNavigationTapTarget(clientX, clientY) {
    return !!getNavigationTapTargetAtClientPoint(clientX, clientY);
}

function getCampusBuildingHitAtClientPoint(clientX, clientY) {
    if (!isCampusMap()) return null;

    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    const imgPt = canvasToImagePoint(canvasX, canvasY);
    if (!imgPt) return null;

    const candidates = getCampusBuildingPolygons();
    const hits = [];

    for (const b of candidates) {
        if (isPointInPolygon(imgPt, b.corners)) {
            hits.push({ name: b.name, corners: b.corners, area: polygonArea(b.corners) });
        }
    }

    if (hits.length === 0) return null;
    hits.sort((a, b) => a.area - b.area);
    return hits[0];
}

function isClientPointOverCampusBuilding(clientX, clientY) {
    return !!getCampusBuildingHitAtClientPoint(clientX, clientY);
}

let canvasPointerDown = null;
let canvasPointerMoved = false;
const CANVAS_TAP_SLOP_PX = 6;

// Mouse wheel zoom event listener
canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    
    if (!lastDrawnImage.img) return;
    const maxZoom = getMaxZoomForImage(lastDrawnImage.img);
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    // Store old zoom level
    const oldZoom = zoomLevel;
    
    // Calculate new zoom level
    const delta = -Math.sign(event.deltaY);
    const factor = 1 + ZOOM_SPEED;
    const desiredZoom = zoomLevel * (delta > 0 ? factor : 1 / factor);
    zoomLevel = Math.max(MIN_ZOOM, Math.min(maxZoom, desiredZoom));
    
    // Reset pan when zooming back to minimum
    if (zoomLevel === MIN_ZOOM) {
        offsetX = 0;
        offsetY = 0;
    } else if (oldZoom !== zoomLevel) {
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
    
    requestRedrawCanvas();
});

// Mouse down event listener for panning
canvas.addEventListener('mousedown', (event) => {
    canvasPointerDown = { x: event.clientX, y: event.clientY };
    canvasPointerMoved = false;

    if (zoomLevel > MIN_ZOOM) {
        isDragging = true;
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        canvas.style.cursor = 'grabbing';
    }
});

// Mouse move event listener for panning
canvas.addEventListener('mousemove', (event) => {
    if (canvasPointerDown && !canvasPointerMoved) {
        const dx = event.clientX - canvasPointerDown.x;
        const dy = event.clientY - canvasPointerDown.y;
        if (Math.hypot(dx, dy) > CANVAS_TAP_SLOP_PX) canvasPointerMoved = true;
    }

    if (isDragging && zoomLevel > MIN_ZOOM) {
        const deltaX = event.clientX - lastMouseX;
        const deltaY = event.clientY - lastMouseY;
        
        offsetX += deltaX;
        offsetY += deltaY;
        
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        
        requestRedrawCanvas();
    } else {
        const navTarget = getNavigationTapTargetAtClientPoint(event.clientX, event.clientY);
        const buildingHit = navTarget ? null : getCampusBuildingHitAtClientPoint(event.clientX, event.clientY);

        const nextHover = navTarget ?
            { kind: 'nav', role: navTarget.role, buildingName: null, corners: null } :
            (buildingHit ? { kind: 'building', role: null, buildingName: buildingHit.name, corners: buildingHit.corners } :
                { kind: null, role: null, buildingName: null, corners: null });

        const hoverChanged = canvasHoverState.kind !== nextHover.kind ||
            canvasHoverState.role !== nextHover.role ||
            canvasHoverState.buildingName !== nextHover.buildingName;
        if (hoverChanged) {
            canvasHoverState = nextHover;
            requestRedrawCanvas();
        }

        const isOverClickable = !!navTarget || !!buildingHit;

        if (isOverClickable) {
            canvas.style.cursor = 'pointer';
        } else if (zoomLevel > MIN_ZOOM) {
            canvas.style.cursor = 'grab';
        } else {
            canvas.style.cursor = 'default';
        }
    }
});

// Mouse up event listener
canvas.addEventListener('mouseup', async (event) => {
    isDragging = false;

    const isOverClickable = isClientPointOverNavigationTapTarget(event.clientX, event.clientY) ||
        isClientPointOverCampusBuilding(event.clientX, event.clientY);
    if (isOverClickable) canvas.style.cursor = 'pointer';
    else if (zoomLevel > MIN_ZOOM) canvas.style.cursor = 'grab';
    else canvas.style.cursor = 'default';

    const pointerDown = canvasPointerDown;
    const shouldTreatAsTap = pointerDown && !canvasPointerMoved && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    canvasPointerDown = null;
    canvasPointerMoved = false;

    if (event.button === 0 && shouldTreatAsTap) {
        if (window.BMEFind?.dev?.doorCampusPick?.active && isCampusMap()) {
            return;
        }
        const handledNavigation = await handleNavigationTapAtClientPoint(event.clientX, event.clientY);
        if (handledNavigation) return;
        await selectCampusBuildingAtClientPoint(event.clientX, event.clientY);
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
    const tapTargets = [];

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
            const muted = !!marker?.muted;
            const hovered = !!marker?.hovered;
            drawStairsMarker(canvasX, canvasY, direction, { muted, hovered });
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
                requestRedrawCanvas();
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

    function drawStairsMarker(canvasX, canvasY, direction, options = {}) {
        const isUp = direction === 'up';
        const muted = !!options.muted;
        const hovered = !!options.hovered;
        const radius = 32 * scale;
        const iconSize = 46 * scale;
        const iconKey = isUp ? 'stairs-up.svg' : 'stairs-down.svg';

        ctx.save();
        ctx.fillStyle = muted ? 'rgba(160, 160, 160, 0.9)' : (isUp ? 'rgba(23, 162, 184, 0.92)' : 'rgba(253, 126, 20, 0.92)');
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.lineWidth = 4 * scale;
        ctx.beginPath();
        ctx.arc(canvasX, canvasY, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (hovered) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
            ctx.beginPath();
            ctx.arc(canvasX, canvasY, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();

        const cached = iconCache.get(iconKey);
        if (cached?.loaded && cached.img) {
            ctx.save();
            if (muted) ctx.filter = 'grayscale(1) saturate(0.2)';
            if (hovered) ctx.filter = `${ctx.filter ? ctx.filter + ' ' : ''}brightness(0.85)`;
            ctx.drawImage(
                cached.img,
                canvasX - iconSize / 2,
                canvasY - iconSize / 2,
                iconSize,
                iconSize
            );
            ctx.restore();
            return;
        }

        if (!cached) {
            const img = new Image();
            iconCache.set(iconKey, { img, loaded: false });
            img.onload = () => {
                iconCache.set(iconKey, { img, loaded: true });
                requestRedrawCanvas();
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
                tapTargets.push({ role: 'next', x: p.x, y: p.y, radius: 44 * scale });
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
            const hovered = canvasHoverState?.kind === 'nav' && canvasHoverState.role === 'next';
            drawStairsMarker(stairsIndicator.x, stairsIndicator.y, stairsIndicator.direction, { hovered });
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
                const hovered = canvasHoverState?.kind === 'nav' && canvasHoverState.role === 'prev';
                startMarker = { type: 'stairs', direction, muted: true, hovered };
                tapTargets.push({ role: 'prev', x: startMarkerPoint.x, y: startMarkerPoint.y, radius: 44 * scale });
            }

            drawStartMarker(startMarkerPoint.x, startMarkerPoint.y, startMarker);
        }
    }

    navigationTapTargets = tapTargets;
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
        startLoading('api');
        let backendOk = true;
        let backendError = null;
        try {
            await loadBackendData();
        } catch (err) {
            backendOk = false;
            backendError = err;
        } finally {
            stopLoading('api');
        }

        if (!backendOk) {
            // Backend is down: still render the campus map (fallback filename is handled by getCurrentFloorFilename()).
            setCurrentFloor({
                building: 'KAMPUSZ',
                floor: '',
                filename: 'map_en.jpg'
            });
            await redrawCanvas();
            console.warn('Backend unavailable; showing campus fallback.', backendError);
            return;
        }
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
    } finally {
        stopLoading('boot');
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
            try {
                await API.checkAuth();
            } catch (error) {
                // Backend can be down: still continue to initializeApp() so we can render the campus fallback map.
                console.warn('Auth check failed during auto-init:', error);
            }
            await initializeApp();
            window.appInitialized = true;
        } catch (error) {
            console.error('Auto-initialization failed:', error);
            stopLoading('boot');
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

function getPxPer100mForNode(node) {
    if (!node) return null;
    const floorEntry = findFloorByBuildingAndFloor(node.building, node.floor);
    const px = Number(floorEntry?.px_per_100m);
    if (!Number.isFinite(px) || px <= 0) return null;
    return px;
}

function computeEdgeDistanceMeters(a, b) {
    if (!a || !b) return 1;

    const ax = Number(a.x);
    const ay = Number(a.y);
    const bx = Number(b.x);
    const by = Number(b.y);
    if (!Number.isFinite(ax) || !Number.isFinite(ay) || !Number.isFinite(bx) || !Number.isFinite(by)) return 1;

    const pixelDistance = Math.hypot(bx - ax, by - ay);

    const aPxPer100m = getPxPer100mForNode(a);
    const bPxPer100m = getPxPer100mForNode(b);
    const aMPerPx = aPxPer100m ? (100 / aPxPer100m) : null;
    const bMPerPx = bPxPer100m ? (100 / bPxPer100m) : null;

    if (aMPerPx && bMPerPx) {
        const sameFloor = a.building === b.building && a.floor === b.floor;
        return sameFloor ? (pixelDistance * aMPerPx) : (pixelDistance * (aMPerPx + bMPerPx) / 2);
    }

    if (aMPerPx) return pixelDistance * aMPerPx;
    if (bMPerPx) return pixelDistance * bMPerPx;
    return pixelDistance;
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
            const dist = computeEdgeDistanceMeters(node.node, neighborNode);

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

