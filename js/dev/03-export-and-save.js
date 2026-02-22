// Export CSV Modal functionality
const exportModal = document.getElementById('exportModal');
const exportNodesBtn = document.getElementById('exportNodes');
const exportTextarea = document.getElementById('exportTextarea');
const copyButton = document.getElementById('copyButton');

// Function to convert csucsokData to CSV
function generateCsucsokCSV() {
    // CSV headers
    const headers = ['id', 'building', 'floor', 'x', 'y', 'campus_x', 'campus_y', 'room_name', 'node_type'];
    let csv = headers.join(',') + '\n';
    
    // Add each row
    nodeData.forEach(node => {
        const row = headers.map(header => {
            const value = node[header].toString() || '';
            // Escape commas and quotes in CSV values
            if (value.includes(',') || value.includes('"') || value.includes('\n')) {
                return '"' + value.replace(/"/g, '""') + '"';
            }
            return value;
        });
        csv += row.join(',') + '\n';
    });
    
    return csv;
}

// Open export modal
if (exportNodesBtn && exportTextarea && exportModal) exportNodesBtn.addEventListener('click', () => {
    const csvData = generateCsucsokCSV();
    exportTextarea.value = csvData;
    exportModal.style.display = 'flex';
    console.log(`Exported ${nodeData.length} nodes to CSV`);
});

// Copy to clipboard functionality
if (copyButton && exportTextarea) copyButton.addEventListener('click', () => {
    exportTextarea.select();
    document.execCommand('copy');
    
    // Show feedback
    const originalText = copyButton.textContent;
    copyButton.textContent = 'âś“ Másolva!';
    copyButton.style.backgroundColor = '#218838';
    
    setTimeout(() => {
        copyButton.textContent = originalText;
        copyButton.style.backgroundColor = '#28a745';
    }, 2000);
});

// Save to Database functionality
const saveToDatabase = document.getElementById('saveToDatabase');
const saveConfirmModal = document.getElementById('saveConfirmModal');
const saveConfirmMessage = document.getElementById('saveConfirmMessage');
const saveConfirmCancel = document.getElementById('saveConfirmCancel');
const saveConfirmOk = document.getElementById('saveConfirmOk');

let saveConfirmResolve = null;

function closeSaveConfirmModal(result) {
    if (saveConfirmModal) saveConfirmModal.style.display = 'none';
    if (typeof saveConfirmResolve === 'function') {
        const resolve = saveConfirmResolve;
        saveConfirmResolve = null;
        resolve(!!result);
    }
}

function confirmSaveChanges(message) {
    if (!saveConfirmModal || !saveConfirmMessage || !saveConfirmCancel || !saveConfirmOk) {
        return Promise.resolve(confirm(message));
    }

    saveConfirmMessage.textContent = message;
    saveConfirmModal.style.display = 'flex';

    return new Promise((resolve) => {
        saveConfirmResolve = resolve;
        setTimeout(() => saveConfirmOk.focus(), 0);
    });
}

if (saveConfirmCancel) {
    saveConfirmCancel.addEventListener('click', () => closeSaveConfirmModal(false));
}
if (saveConfirmOk) {
    saveConfirmOk.addEventListener('click', () => closeSaveConfirmModal(true));
}
if (saveConfirmModal) {
    const closeBtn = saveConfirmModal.querySelector('.close');
    if (closeBtn) closeBtn.addEventListener('click', () => closeSaveConfirmModal(false));
    window.addEventListener('click', (event) => {
        if (event.target === saveConfirmModal) closeSaveConfirmModal(false);
    });
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && saveConfirmModal.style.display !== 'none') {
            closeSaveConfirmModal(false);
        }
    });
}

saveToDatabase.addEventListener('click', async () => {
    // Check auth state
    if (!authState.authenticated) {
        showSaveResultPopup('Bejelentkezés szükséges', 'A mentéshez be kell jelentkezned.', 'error');
        return;
    }

    if (!authState.isAdmin && authState.buildingPermissions.length === 0) {
        showSaveResultPopup('Nincs jogosultság', 'Nincs egyetlen épülethez sem szerkesztési jogosultságod.', 'error');
        return;
    }

    // Calculate diffs
    const nodesDiff = calculateNodesDiff();
    const edgesDiff = calculateEdgesDiff();

    // Filter diffs by permissions
    const filtered = filterDiffsByPermissions(nodesDiff, edgesDiff, authState.buildingPermissions);

    // Check if there are any changes
    const totalChanges =
        filtered.nodes.added.length +
        filtered.nodes.updated.length +
        filtered.nodes.deleted.length +
        filtered.edges.added.length +
        filtered.edges.deleted.length;

    if (totalChanges === 0) {
        showSaveResultPopup('Nincs módosítás', 'Nem történt változás, amit menteni kellene.', 'error');
        return;
    }

    // Show confirmation with change summary
    let confirmMessage = 'Biztosan menteni szeretnéd a következő módosításokat?\n\n';
    confirmMessage += `Csúcsok hozzáadva: ${filtered.nodes.added.length}\n`;
    confirmMessage += `Csúcsok frissítve: ${filtered.nodes.updated.length}\n`;
    confirmMessage += `Csúcsok törölve: ${filtered.nodes.deleted.length}\n`;
    confirmMessage += `Élek hozzáadva: ${filtered.edges.added.length}\n`;
    confirmMessage += `Élek törölve: ${filtered.edges.deleted.length}`;
    const shouldSave = await confirmSaveChanges(confirmMessage);
    if (!shouldSave) return;

    // Disable button during save
    saveToDatabase.disabled = true;
    saveToDatabase.textContent = 'Mentés...';
    saveToDatabase.style.backgroundColor = '#6c757d';

    try {
        // Prepare changes object
        const changes = {
            nodes: filtered.nodes,
            edges: filtered.edges
        };

        console.log('Applying changes to database...', changes);
        const result = await API.applyChanges(changes);

        if (!result.success) {
            throw new Error(result.error);
        }

        // Update snapshots after successful save
        updateSnapshots();

        // Show detailed result
        const stats = result.stats || {};
        let message = `Sikeresen mentve!\n\n`;
        message += `Csúcsok hozzáadva: ${stats.nodes_added || 0}\n`;
        message += `Csúcsok frissítve: ${stats.nodes_updated || 0}\n`;
        message += `Csúcsok törölve: ${stats.nodes_deleted || 0}\n`;
        message += `Élek hozzáadva: ${stats.edges_added || 0}\n`;
        message += `Élek törölve: ${stats.edges_deleted || 0}`;

        showSaveResultPopup('Mentés sikeres', message, 'success');

        console.log('Changes applied successfully:', stats);

        // Reset button
        saveToDatabase.textContent = 'Módosítások mentése';
        saveToDatabase.style.backgroundColor = '#dc3545';
        saveToDatabase.disabled = false;
        updateSaveButtonState();

    } catch (error) {
        console.error('Error saving to database:', error);
        showSaveResultPopup('Hiba', 'Mentés sikertelen: ' + error.message, 'error');

        saveToDatabase.textContent = 'Módosítások mentése';
        saveToDatabase.style.backgroundColor = '#dc3545';
        saveToDatabase.disabled = false;
        updateSaveButtonState();
    }
});

// Export Elek.txt functionality
const exportEdgesBtn = document.getElementById('exportEdges');

// Function to generate elek.txt format
function generateElekTxt() {
    let txt = '';
    
    // Get all unique node IDs and sort them
    const allIds = Array.from(new Set(nodeData.map(c => c.id))).sort((a, b) => a - b);
    
    // For each node ID, output the ID followed by its neighbors
    allIds.forEach(id => {
        const neighbors = buildingGraph[id] || [];
        txt += id;
        if (neighbors.length > 0) {
            txt += ' ' + neighbors.join(' ');
        }
        txt += '\n';
    });
    
    return txt;
}

// Open export modal with elek.txt content
if (exportEdgesBtn && exportTextarea && exportModal) exportEdgesBtn.addEventListener('click', () => {
    const edgeData = generateElekTxt();
    exportTextarea.value = edgeData;
    exportModal.style.display = 'flex';
    
    // Count connections
    const totalConnections = Object.values(buildingGraph).reduce((sum, neighbors) => sum + neighbors.length, 0) / 2;
    console.log(`Exported elek.txt with ${Object.keys(buildingGraph).length} nodes and ${totalConnections} connections`);
});

// Close modals when clicking X
document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', () => {
        const modalId = closeBtn.getAttribute('data-modal');
        if (modalId) {
            document.getElementById(modalId).style.display = 'none';
        }
    });
});

// Close modals when clicking outside of them
const loginModal = document.getElementById('loginModal');
const saveResultModal = document.getElementById('saveResultModal');
const saveResultOk = document.getElementById('saveResultOk');

function closeSaveResultModal() {
    if (saveResultModal) saveResultModal.style.display = 'none';
}

if (saveResultOk) {
    saveResultOk.addEventListener('click', closeSaveResultModal);
}

	window.addEventListener('click', (event) => {
	    if (event.target === buildingModal) {
	        buildingModal.style.display = 'none';
	    }
	    if (floorModal && event.target === floorModal) {
	        floorModal.style.display = 'none';
	    }
	    if (event.target === exportModal) {
	        exportModal.style.display = 'none';
	    }
	    if (doorModal && event.target === doorModal) {
	        doorModal.style.display = 'none';
    }
    if (event.target === loginModal) {
        loginModal.style.display = 'none';
    }
    if (event.target === saveResultModal) {
        saveResultModal.style.display = 'none';
    }
});

// Close modals when pressing Escape
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        if (buildingModal) buildingModal.style.display = 'none';
        if (floorModal) floorModal.style.display = 'none';
        if (exportModal) exportModal.style.display = 'none';
        if (doorModal) doorModal.style.display = 'none';
        if (loginModal) loginModal.style.display = 'none';
        if (saveResultModal) saveResultModal.style.display = 'none';
        return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
        if (saveResultModal && saveResultModal.style.display !== 'none') {
            event.preventDefault();
            closeSaveResultModal();
        }
    }
});

// Login button handler
document.getElementById('loginButton').addEventListener('click', () => {
    loginModal.style.display = 'flex';
    document.getElementById('loginUsername').focus();
});

// Logout button handler
document.getElementById('logoutButton').addEventListener('click', async () => {
    try {
        await API.logout();
        updateAuthState({ authenticated: false, user: null, building_permissions: [] });
    } catch (error) {
        console.error('Logout failed:', error);
    }
});

// Login form handler
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');

    try {
        const result = await API.login(username, password);

        if (result.success) {
            updateAuthState({
                authenticated: true,
                user: result.user,
                building_permissions: result.user.building_permissions
            });
            loginModal.style.display = 'none';
            document.getElementById('loginForm').reset();
            errorDiv.style.display = 'none';
        } else {
            errorDiv.textContent = result.error || 'Bejelentkezés sikertelen';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        errorDiv.textContent = 'Hálózati hiba történt';
        errorDiv.style.display = 'block';
    }
});

// Initialize application with proper sequencing
initializeApplication();

console.log('Dev UI loaded - Press ALT+Click to get coordinates');
