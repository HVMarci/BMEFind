// Development UI features
// This file contains development tools for debugging and mapping coordinate placement

// Track selected node for graph editing
let selectedNodeId = null;

// TODO move this to api-client.js
// Authentication state
let authState = {
    authenticated: false,
    user: null,
    buildingPermissions: [],
    isAdmin: false
};

// Initialize auth state on page load
async function initializeAuth() {
    try {
        const authResult = await API.checkAuth();
        updateAuthState(authResult);
        return authResult;
    } catch (error) {
        console.error('Failed to check auth:', error);
        const fallbackAuth = { authenticated: false, user: null, building_permissions: [] };
        updateAuthState(fallbackAuth);
        return fallbackAuth;
    }
}

// Master initialization - coordinates auth then data loading
async function initializeApplication() {
    // Mark that we're handling initialization (prevents app.js auto-init)
    window.appInitialized = true;

    try {
        console.log('Starting application initialization...');

        // Step 1: Check authentication FIRST (establishes session)
        console.log('Step 1: Checking authentication...');
        const authResult = await initializeAuth();
        console.log('Auth complete:', authResult.authenticated ? 'authenticated' : 'not authenticated');

        // Step 2: Load backend data (uses established session)
        console.log('Step 2: Loading backend data...');
        await window.initializeApp();
        console.log('Application initialization complete');

    } catch (error) {
        console.error('Application initialization failed:', error);
        alert('Hiba történt az alkalmazás betöltése során. Kérjük, frissítse az oldalt.');
    }
}

// Update auth state and UI
function updateAuthState(authResult) {
    authState.authenticated = authResult.authenticated;
    authState.user = authResult.user;
    authState.buildingPermissions = authResult.building_permissions || [];
    authState.isAdmin = !!(authResult.user && authResult.user.is_admin);

    updateAuthUI();
    updateSaveButtonState();
}

function canEditBuilding(building) {
    if (!authState.authenticated) return false;
    if (authState.isAdmin) return true;
    return authState.buildingPermissions.includes(building);
}

function isCampusFloor(floor) {
    return !!floor && floor.building === 'KAMPUSZ';
}

// Update auth UI elements
function updateAuthUI() {
    const authStatusText = document.getElementById('authStatusText');
    const loginButton = document.getElementById('loginButton');
    const logoutButton = document.getElementById('logoutButton');
    const authStatus = document.getElementById('authStatus');

    if (authState.authenticated && authState.user) {
        let statusText = `Bejelentkezve: ${authState.user.display_name}`;
        if (authState.isAdmin) {
            statusText += ' (admin)';
        } else if (authState.buildingPermissions.length > 0) {
            statusText += ` (${authState.buildingPermissions.join(', ')})`;
        } else {
            statusText += ' (nincs jogosultság)';
        }
        authStatusText.textContent = statusText;
        loginButton.style.display = 'none';
        logoutButton.style.display = 'inline-block';
        authStatus.classList.add('authenticated');
    } else {
        authStatusText.textContent = 'Nem vagy bejelentkezve';
        loginButton.style.display = 'inline-block';
        logoutButton.style.display = 'none';
        authStatus.classList.remove('authenticated');
    }
}

// Update save button state based on permissions
function updateSaveButtonState() {
    const saveButton = document.getElementById('saveToDatabase');

    if (!authState.authenticated || (!authState.isAdmin && authState.buildingPermissions.length === 0)) {
        saveButton.classList.add('no-permissions');
        saveButton.disabled = true;
        saveButton.title = authState.authenticated
            ? 'Nincs jogosultságod egyetlen épülethez sem'
            : 'Bejelentkezés szükséges a mentéshez';
    } else {
        saveButton.classList.remove('no-permissions');
        saveButton.disabled = false;
        if (authState.isAdmin) {
            saveButton.title = 'Mentés (admin)';
            return;
        }
        saveButton.title = `Mentés (jogosultság: ${authState.buildingPermissions.join(', ')})`;
    }
}

// Show save result popup
function showSaveResultPopup(title, message, type) {
    const modal = document.getElementById('saveResultModal');
    const header = document.getElementById('saveResultHeader');
    const titleEl = document.getElementById('saveResultTitle');
    const messageEl = document.getElementById('saveResultMessage');

    titleEl.textContent = title;
    messageEl.textContent = message;

    // Remove previous type classes and add new one
    header.classList.remove('success', 'warning', 'error');
    header.classList.add(type);

    modal.style.display = 'flex';
}

// Draw graph connections (green lines between connected nodes)
function drawGraphConnections() {
    if (!lastDrawnImage.img || !currentFloor?.filename) return;

    const scale = getImageScale();

    if (!currentFloor?.building || isCampusFloor(currentFloor)) return;

    // Filter points that match current building and floor
    const relevantPoints = nodeData.filter(point =>
        point.building === currentFloor.building && point.floor === currentFloor.floor
    );

    // Draw connections between nodes
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.lineWidth = 4 * scale;
    
    relevantPoints.forEach(point => {
        const pointId = point.id;
        const neighbors = buildingGraph[pointId] || [];
        
        neighbors.forEach(neighborId => {
            const neighbor = nodeData.find(c => c.id === neighborId);
            
            // Only draw if neighbor is on the same floor (to avoid duplicate lines)
            if (neighbor && neighbor.building === point.building && 
                neighbor.floor === point.floor && neighbor.id > pointId) {

                const x1 = point.x;
                const y1 = point.y;
                const x2 = neighbor.x;
                const y2 = neighbor.y;
                
                const p1 = imageToCanvasPoint(x1, y1);
                const p2 = imageToCanvasPoint(x2, y2);
                if (!p1 || !p2) return;
                
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        });
    });
}

const devIconCache = new Map();

function getPoiIconKeyForNode(node) {
    const t = String(node?.node_type ?? '');
    if (t === '3') return 'wc-ferfi.svg';
    if (t === '4') return 'wc-noi.svg';
    if (t === '5') return 'wc-mozgasserult.svg';
    if (t === '6') return 'mikro.svg';
    return null;
}

function drawCachedDevIcon(iconKey, canvasX, canvasY, iconSize) {
    const cached = devIconCache.get(iconKey);
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
        devIconCache.set(iconKey, { img, loaded: false });
        img.onload = () => {
            devIconCache.set(iconKey, { img, loaded: true });
            requestRedrawCanvas();
        };
        img.src = iconKey;
    }
}

function drawOutlinedIdText(text, x, y, scale) {
    ctx.save();
    ctx.font = `bold ${22 * scale}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = 'lightblue';
    ctx.lineWidth = 5 * scale;
    ctx.strokeText(text, x, y);

    ctx.fillStyle = 'white';
    ctx.fillText(text, x, y);
    ctx.restore();
}

// Draw nodes for debugging
function drawNodes() {
    if (!lastDrawnImage.img || !currentFloor?.filename) return;

    const scale = getImageScale();

    if (!currentFloor?.building || isCampusFloor(currentFloor)) return;

    // Filter points that match current building and floor
    const relevantPoints = nodeData.filter(point =>
        point.building === currentFloor.building && point.floor === currentFloor.floor
    );

    // Draw each point
    relevantPoints.forEach(point => {
        const x = point.x;
        const y = point.y;

        const pt = imageToCanvasPoint(x, y);
        if (!pt) return;

        const poiIconKey = getPoiIconKeyForNode(point);
        if (poiIconKey) {
            const iconSize = 62 * scale;
            drawCachedDevIcon(poiIconKey, pt.x, pt.y, iconSize);
            drawOutlinedIdText(String(point.id), pt.x, pt.y, scale);
            return;
        }

        // Draw green circle
        const radius = 30 * scale;
        ctx.fillStyle = 'green';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
        ctx.fill();

        // Draw white border
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 4 * scale;
        ctx.stroke();

        // Draw the ID text in white
        ctx.fillStyle = 'white';
        ctx.font = `bold ${24 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // For type 1, show "ID-room_name", otherwise just ID
        let displayText = point.id;
        if (String(point.node_type) === '1' && point.room_name) {
            ctx.fillStyle = 'lightblue';
            displayText = `${point.id}-${point.room_name}`;
        } else if (String(point.node_type) === '2') {
            ctx.fillStyle = 'orange';
        }
        ctx.fillText(displayText, pt.x, pt.y);
    });
}

