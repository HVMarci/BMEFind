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
let termekData = [];
let epuletekData = [];
let ajtokData = [];
let currentMarker = null;
let currentPath = null;
let navigationState = {
    segments: [],
    currentStep: -1,
    roomData: null
};

// Load CSV files
async function loadCSVData() {
    try {
        const termekResponse = await fetch('termek.csv');
        const termekText = await termekResponse.text();
        termekData = parseCSV(termekText);
        
        const epuletekResponse = await fetch('epuletek.csv');
        const epuletekText = await epuletekResponse.text();
        epuletekData = parseCSV(epuletekText);
        
        const ajtokResponse = await fetch('ajtok.csv');
        const ajtokText = await ajtokResponse.text();
        ajtokData = parseCSV(ajtokText);
        
        // Process utvonal column in termekData
        termekData.forEach(room => {
            if (room.utvonal) {
                room.utvonalParsed = parseUtvonal(room.utvonal);
            }
        });
    } catch (error) {
        console.error('Error loading CSV files:', error);
    }
}

function parseUtvonal(utvonalString) {
    // Remove brackets and split by semicolons for different building segments
    const cleaned = utvonalString.replace(/[()]/g, '');
    const segmentStrings = cleaned.split(';');
    
    const segments = [];
    for (const segmentString of segmentStrings) {
        const parts = segmentString.split(':');
        if (parts.length !== 2) continue;
        
        const [buildingFloor, pathString] = parts;
        const [epulet, emelet] = buildingFloor.split('/').map(s => s.trim());
        
        const pathParts = pathString.split('/').map(s => s.trim());
        const doors = [];
        
        for (let i = 0; i < pathParts.length; i += 2) {
            if (i + 1 < pathParts.length) {
                doors.push({
                    teremnev: pathParts[i],
                    id: pathParts[i + 1]
                });
            }
        }
        
        segments.push({
            epulet: epulet,
            emelet: emelet,
            doors: doors
        });
    }
    
    return segments;
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const obj = {};
        const values = lines[i].split(',').map(v => v.trim());
        headers.forEach((header, index) => {
            obj[header] = values[index];
        });
        data.push(obj);
    }
    
    return data;
}

function findRoomData(roomName) {
    return termekData.find(room => room.teremnev && room.teremnev.toLowerCase() === roomName.toLowerCase());
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

function findDoorById(teremnev, id) {
    return ajtokData.find(door => door.teremnev === teremnev && door.id === id);
}

function drawPath(doors, roomX, roomY, isLastSegment) {
    if (!lastDrawnImage.img || !doors) return;
    
    const coordinates = [];
    
    // Get coordinates for each door in the path
    for (const step of doors) {
        const door = findDoorById(step.teremnev, step.id);
        if (door && door.x && door.y) {
            coordinates.push({
                x: parseInt(door.x),
                y: parseInt(door.y)
            });
        }
    }
    
    // Add the final room coordinates only if this is the last segment
    if (isLastSegment && roomX && roomY) {
        coordinates.push({
            x: parseInt(roomX),
            y: parseInt(roomY)
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

function drawImage(filename) {
    currentImageFilename = filename;
    
    // Reset zoom and pan when changing images
    zoomLevel = 1;
    offsetX = 0;
    offsetY = 0;
    
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

function redrawCanvas() {
    if (!lastDrawnImage.img) return;
    
    renderImage(lastDrawnImage.img);
    
    // Redraw markers and paths if they exist
    if (navigationState.currentStep === -1 && navigationState.roomData) {
        const buildingData = findImageFilename(navigationState.roomData.epulet, navigationState.roomData.emelet);
        if (buildingData && buildingData.x && buildingData.y) {
            drawBuildingMarker(parseInt(buildingData.x), parseInt(buildingData.y));
        }
    } else if (currentPath) {
        const isLastSegment = navigationState.currentStep === navigationState.segments.length - 1;
        const roomX = isLastSegment && currentMarker ? currentMarker.x : null;
        const roomY = isLastSegment && currentMarker ? currentMarker.y : null;
        
        drawPath(currentPath, roomX, roomY, isLastSegment);
        
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

// Canvas click event listener - only show coordinates when zoomed out
canvas.addEventListener('click', (event) => {
    if (!lastDrawnImage.img) return;
    
    // Show alert when ALT is pressed
    if (!event.altKey) return;
    
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
    
    alert(`${imageX},${imageY}`);
});

// Load CSV data first, then draw initial image
loadCSVData().then(() => {
    drawImage(getDefaultMapFilename());
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
        
        // Initialize navigation state
        navigationState = {
            segments: roomData.utvonalParsed || [],
            currentStep: -1,
            roomData: roomData
        };
        
        // Draw campus map first
        await drawImage(getDefaultMapFilename());
        
        // Get building coordinates from epuletek.csv
        const buildingData = findImageFilename(roomData.epulet, roomData.emelet);
        if (buildingData && buildingData.x && buildingData.y) {
            drawBuildingMarker(parseInt(buildingData.x), parseInt(buildingData.y));
        }
        
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
        const segment = navigationState.segments[navigationState.currentStep];
        const isLastSegment = navigationState.currentStep === navigationState.segments.length - 1;
        
        // Draw the building's image
        const buildingData = findImageFilename(segment.epulet, segment.emelet);
        if (!buildingData || !buildingData.filename) {
            alert('Az épület/szint térkép nem található!');
            return;
        }
        
        await drawImage(buildingData.filename);
        
        // Draw the path for this segment
        const roomX = isLastSegment ? parseInt(navigationState.roomData.x) : null;
        const roomY = isLastSegment ? parseInt(navigationState.roomData.y) : null;
        
        currentPath = segment.doors;
        currentMarker = isLastSegment ? { x: roomX, y: roomY } : null;
        
        drawPath(segment.doors, roomX, roomY, isLastSegment);
        
        if (isLastSegment && roomX && roomY) {
            drawMarker(roomX, roomY);
        }
        
        // Check if this is the last segment
        if (navigationState.currentStep === navigationState.segments.length - 1) {
            nextButton.className = 'disabled';
            nextButton.disabled = true;
        }
    }
});

const returnButton = document.querySelector('#returnButton');
returnButton.addEventListener('click', async () => {
    currentMarker = null;
    currentPath = null;
    navigationState = { segments: [], currentStep: -1, roomData: null };
    nextButton.className = 'disabled';
    nextButton.disabled = true;
    await drawImage(getDefaultMapFilename());
});

window.addEventListener('resize', async () => {
    canvas.width = window.innerWidth - SIDEBAR_WIDTH;
    canvas.height = window.innerHeight;
    if (currentImageFilename) {
        await drawImage(currentImageFilename);
        
        // If on campus map, redraw building marker
        if (navigationState.currentStep === -1 && navigationState.roomData) {
            const buildingData = findImageFilename(navigationState.roomData.epulet, navigationState.roomData.emelet);
            if (buildingData && buildingData.x && buildingData.y) {
                drawBuildingMarker(parseInt(buildingData.x), parseInt(buildingData.y));
            }
        }
        // If navigating through segments, redraw current path and marker
        else if (currentPath) {
            const isLastSegment = navigationState.currentStep === navigationState.segments.length - 1;
            const roomX = isLastSegment && currentMarker ? currentMarker.x : null;
            const roomY = isLastSegment && currentMarker ? currentMarker.y : null;
            
            drawPath(currentPath, roomX, roomY, isLastSegment);
            
            if (currentMarker) {
                drawMarker(currentMarker.x, currentMarker.y);
            }
        }
    }
});
