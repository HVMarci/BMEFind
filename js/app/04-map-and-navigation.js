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
    if (redrawCanvas._inFlight) {
        redrawCanvas._needsAnotherPass = true;
        return redrawCanvas._inFlight;
    }

    redrawCanvas._inFlight = (async () => {
        do {
            redrawCanvas._needsAnotherPass = false;
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
    const defaultFloor = chooseDefaultFloorForBuilding(buildingName);
    if (!defaultFloor) return false;

    await applyFloorSelection(defaultFloor);
    return true;
}

window.selectCampusBuildingAtClientPoint = selectCampusBuildingAtClientPoint;

let canvasPointerDown = null;
let canvasPointerMoved = false;
const CANVAS_TAP_SLOP_PX = 6;

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
    } else if (zoomLevel > MIN_ZOOM) {
        canvas.style.cursor = 'grab';
    } else {
        canvas.style.cursor = 'default';
    }
});

// Mouse up event listener
canvas.addEventListener('mouseup', async (event) => {
    isDragging = false;
    if (zoomLevel > MIN_ZOOM) {
        canvas.style.cursor = 'grab';
    } else {
        canvas.style.cursor = 'default';
    }

    const pointerDown = canvasPointerDown;
    const shouldTreatAsTap = pointerDown && !canvasPointerMoved && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
    canvasPointerDown = null;
    canvasPointerMoved = false;

    if (event.button === 0 && shouldTreatAsTap) {
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

