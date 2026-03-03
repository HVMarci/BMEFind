// Save to Database functionality
const saveToDatabase = document.getElementById('saveToDatabase');

function confirmSaveChanges(message) {
    if (window.BMEFind?.ui?.modal?.confirm) {
        return window.BMEFind.ui.modal.confirm(message, { title: 'Mentés megerősítése', type: 'warning' });
    }
    return Promise.resolve(false);
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

	window.addEventListener('click', (event) => {
	    if (event.target === buildingModal) {
	        buildingModal.style.display = 'none';
	    }
 	    if (floorModal && event.target === floorModal) {
 	        floorModal.style.display = 'none';
 	    }
 	    if (doorModal && event.target === doorModal) {
 	        doorModal.style.display = 'none';
     }
     if (event.target === loginModal) {
        loginModal.style.display = 'none';
    }
});

// Close modals when pressing Escape
window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        if (buildingModal) buildingModal.style.display = 'none';
        if (floorModal) floorModal.style.display = 'none';
        if (doorModal) doorModal.style.display = 'none';
        if (loginModal) loginModal.style.display = 'none';
        return;
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
