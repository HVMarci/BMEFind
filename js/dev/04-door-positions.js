function getDevSelectedNode() {
    if (typeof selectedNodeId === 'undefined' || selectedNodeId === null) return null;
    if (!Array.isArray(nodeData)) return null;
    return nodeData.find(n => n.id === selectedNodeId) || null;
}

function ensureDevNamespace() {
    window.BMEFind = window.BMEFind || {};
    window.BMEFind.dev = window.BMEFind.dev || {};
    return window.BMEFind.dev;
}

function formatNodeTypeLabel(nodeType) {
    const t = String(nodeType);
    if (t === '0') return 'Folyosó';
    if (t === '1') return 'Terem';
    if (t === '2') return 'Ajtó';
    if (t === '3') return 'WC (Férfi)';
    if (t === '4') return 'WC (Női)';
    if (t === '5') return 'WC (Mozgássérült)';
    if (t === '6') return 'Mikró';
    return `Ismeretlen (${t})`;
}

function isDoorNode(node) {
    return !!node && String(node.node_type) === '2';
}

function updateDoorPositionPanel() {
    const selectedSummary = document.getElementById('selectedNodeSummary');
    const selectedCoords = document.getElementById('selectedNodeCoords');
    const pickBtn = document.getElementById('pickDoorCampusPos');
    const clearBtn = document.getElementById('clearDoorCampusPos');
    const statusEl = document.getElementById('doorCampusPickStatus');

    if (!selectedSummary || !selectedCoords || !pickBtn || !clearBtn || !statusEl) return;

    const dev = ensureDevNamespace();
    const pickState = dev.doorCampusPick;
    const node = getDevSelectedNode();

    if (!node) {
        selectedSummary.textContent = '–';
        selectedCoords.textContent = '';
        pickBtn.textContent = 'Beállítás';
        pickBtn.classList.remove('btn-success');
        pickBtn.classList.add('btn-info');
        pickBtn.disabled = true;
        clearBtn.textContent = 'Törlés';
        clearBtn.classList.remove('btn-danger');
        clearBtn.classList.add('btn-warning');
        clearBtn.disabled = true;
        statusEl.textContent = '';
        return;
    }

    const typeLabel = formatNodeTypeLabel(node.node_type);
    const roomName = node.room_name ? ` – ${node.room_name}` : '';
    selectedSummary.textContent = `#${node.id} (${typeLabel})${roomName}`;
    selectedCoords.textContent = `Térkép: ${node.building} / ${node.floor} – (${node.x}, ${node.y})`;

    if (!isDoorNode(node)) {
        pickBtn.disabled = true;
        clearBtn.disabled = true;
        pickBtn.textContent = 'Beállítás';
        pickBtn.classList.remove('btn-success');
        pickBtn.classList.add('btn-info');
        clearBtn.textContent = 'Törlés';
        clearBtn.classList.remove('btn-danger');
        clearBtn.classList.add('btn-warning');
        statusEl.textContent = 'Kampusz ajtópozíció csak "Ajtó" (2-es típus) csúcson érhető el.';
        return;
    }

    const hasCampusPos = node.campus_x != null && node.campus_y != null;
    const isPickingThisNode = !!(pickState?.active && pickState.nodeId === node.id);

    pickBtn.classList.toggle('btn-success', isPickingThisNode);
    pickBtn.classList.toggle('btn-info', !isPickingThisNode);
    clearBtn.classList.toggle('btn-danger', isPickingThisNode);
    clearBtn.classList.toggle('btn-warning', !isPickingThisNode);

    if (isPickingThisNode) {
        const hasPending = pickState.pendingX != null && pickState.pendingY != null;
        if (hasPending) {
            pickBtn.textContent = 'Mentés';
            pickBtn.disabled = false;
        } else {
            pickBtn.textContent = 'Mentés';
            // If user hasn't clicked anywhere yet, allow saving only if we already have an existing position.
            pickBtn.disabled = !hasCampusPos;
        }
        clearBtn.textContent = 'Mégse';
        clearBtn.disabled = false;
    } else {
        pickBtn.textContent = 'Beállítás';
        pickBtn.disabled = false;
        clearBtn.textContent = 'Törlés';
        clearBtn.disabled = !hasCampusPos;
    }

    const lines = [];
    if (hasCampusPos) {
        lines.push(`Kampusz pozíció: (${node.campus_x}, ${node.campus_y})`);
    } else {
        lines.push('Kampusz pozíció: nincs beállítva');
    }
    if (isPickingThisNode) {
        if (pickState.pendingX != null && pickState.pendingY != null) {
            lines.push(`Új (még nem mentett) pozíció: (${pickState.pendingX}, ${pickState.pendingY})`);
            lines.push('ENTER vagy a zöld gomb: mentés. ESC: megszakítás.');
        } else {
            lines.push('Kiválasztás aktív: kattints a kampusztérképen. ESC: megszakítás.');
        }
    }
    statusEl.textContent = lines.join('\n');
}

function beginDoorCampusPick() {
    const modal = window.BMEFind?.ui?.modal;
    const node = getDevSelectedNode();
    if (!isDoorNode(node)) {
        if (modal?.alert) modal.alert('Először jelölj ki egy "Ajtó" (2-es típus) csúcsot.', { title: 'Hiba', type: 'error' });
        else console.error('Először jelölj ki egy "Ajtó" (2-es típus) csúcsot.');
        return;
    }

    let targetCampusFloorId = campusFloorId;
    if (!targetCampusFloorId) {
        const campusFloor = getDefaultCampusFloor();
        targetCampusFloorId = campusFloor?.id ?? null;
    }
    if (!targetCampusFloorId) {
        if (modal?.alert) modal.alert('Nem található kampusztérkép (KAMPUSZ) a floors táblában.', { title: 'Hiba', type: 'error' });
        else console.error('Nem található kampusztérkép (KAMPUSZ) a floors táblában.');
        return;
    }

    const dev = ensureDevNamespace();
    dev.doorCampusPick = {
        active: true,
        nodeId: node.id,
        returnFloorId: currentFloor?.id ?? null,
        pendingX: null,
        pendingY: null
    };
    dev._suppressSelectionClearOnce = true;

    setCurrentFloorById(targetCampusFloorId);
    requestRedrawCanvas();
    updateDoorPositionPanel();
}

function cancelDoorCampusPick() {
    const dev = ensureDevNamespace();
    const pickState = dev.doorCampusPick;
    if (!pickState?.active) return;

    pickState.active = false;
    pickState.pendingX = null;
    pickState.pendingY = null;
    dev._suppressSelectionClearOnce = true;
    if (pickState.returnFloorId != null) {
        setCurrentFloorById(pickState.returnFloorId);
    }
    requestRedrawCanvas();
    updateDoorPositionPanel();
}

function setDoorCampusPickPending(x, y) {
    const dev = ensureDevNamespace();
    const pickState = dev.doorCampusPick;
    if (!pickState?.active) return false;
    if (!isCampusFloor(currentFloor)) return false;

    pickState.pendingX = x;
    pickState.pendingY = y;
    requestRedrawCanvas();
    updateDoorPositionPanel();
    return true;
}

function showDoorCampusPickSuccessPopup() {
    const modal = window.BMEFind?.ui?.modal;
    if (typeof showSaveResultPopup === 'function') {
        showSaveResultPopup('Siker', 'A kampusz ajtópozíció sikeresen be lett állítva.', 'success');
        return;
    }
    if (modal?.toast) modal.toast('A kampusz ajtópozíció sikeresen be lett állítva.', { type: 'success' });
    else if (modal?.alert) modal.alert('A kampusz ajtópozíció sikeresen be lett állítva.', { title: 'Siker', type: 'success' });
    else console.log('A kampusz ajtópozíció sikeresen be lett állítva.');
}

function showDoorCampusClearSuccessPopup() {
    const modal = window.BMEFind?.ui?.modal;
    if (typeof showSaveResultPopup === 'function') {
        showSaveResultPopup('Siker', 'A kampusz ajtópozíció törölve lett.', 'success');
        return;
    }
    if (modal?.toast) modal.toast('A kampusz ajtópozíció törölve lett.', { type: 'success' });
    else if (modal?.alert) modal.alert('A kampusz ajtópozíció törölve lett.', { title: 'Siker', type: 'success' });
    else console.log('A kampusz ajtópozíció törölve lett.');
}

function confirmDoorCampusPick() {
    const dev = ensureDevNamespace();
    const pickState = dev.doorCampusPick;
    if (!pickState?.active) return false;

    const node = Array.isArray(nodeData) ? nodeData.find(n => n.id === pickState.nodeId) : null;
    if (!isDoorNode(node)) return false;

    const hasPending = pickState.pendingX != null && pickState.pendingY != null;
    const hasExisting = node.campus_x != null && node.campus_y != null;

    if (!hasPending && !hasExisting) {
        return false;
    }

    if (hasPending) {
        node.campus_x = pickState.pendingX;
        node.campus_y = pickState.pendingY;
    }

    pickState.active = false;
    pickState.pendingX = null;
    pickState.pendingY = null;

    const returnFloorId = pickState.returnFloorId;
    dev._suppressSelectionClearOnce = true;

    selectedNodeId = null;

    if (returnFloorId != null) {
        setCurrentFloorById(returnFloorId);
    }

    requestRedrawCanvas();
    updateDoorPositionPanel();
    showDoorCampusPickSuccessPopup();
    return true;
}

function clearSelectedDoorCampusPos() {
    const node = getDevSelectedNode();
    if (!isDoorNode(node)) return;
    const hadCampusPos = node.campus_x != null || node.campus_y != null;
    node.campus_x = null;
    node.campus_y = null;
    requestRedrawCanvas();
    updateDoorPositionPanel();
    if (hadCampusPos) showDoorCampusClearSuccessPopup();
}

function drawCampusDoorMarkerOverlay() {
    if (!lastDrawnImage?.img || !currentFloor?.filename) return;
    if (!isCampusFloor(currentFloor)) return;

    const node = getDevSelectedNode();
    if (!isDoorNode(node)) return;

    const scale = getImageScale();
    const radius = 18 * scale;

    const dev = ensureDevNamespace();
    const pickState = dev.doorCampusPick;
    const isPickingThisNode = !!(pickState?.active && pickState.nodeId === node.id);

    const pendingX = isPickingThisNode ? pickState.pendingX : null;
    const pendingY = isPickingThisNode ? pickState.pendingY : null;

    const existingX = node.campus_x;
    const existingY = node.campus_y;

    if (existingX != null && existingY != null) {
        const pt = imageToCanvasPoint(existingX, existingY);
        if (pt) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 165, 0, 0.28)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 3 * scale;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    }

    if (pendingX != null && pendingY != null) {
        const pt = imageToCanvasPoint(pendingX, pendingY);
        if (pt) {
            ctx.save();
            ctx.fillStyle = 'rgba(255, 193, 7, 0.85)';
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'white';
            ctx.lineWidth = 3 * scale;
            ctx.stroke();
            ctx.restore();
        }
    }
}

(function initDoorPositionUI() {
    const pickBtn = document.getElementById('pickDoorCampusPos');
    const clearBtn = document.getElementById('clearDoorCampusPos');

    if (pickBtn) {
        pickBtn.addEventListener('click', () => {
            const dev = ensureDevNamespace();
            const pickState = dev.doorCampusPick;
            if (pickState?.active) {
                const ok = confirmDoorCampusPick();
                const node = getDevSelectedNode();
                const hasExisting = node && node.campus_x != null && node.campus_y != null;
                if (!ok && pickState.pendingX == null && pickState.pendingY == null && !hasExisting) {
                    const modal = window.BMEFind?.ui?.modal;
                    if (modal?.alert) modal.alert('Előbb kattints a kampusztérképre a kívánt pozíción.', { title: 'Hiba', type: 'error' });
                    else console.error('Előbb kattints a kampusztérképre a kívánt pozíción.');
                }
                return;
            }
            beginDoorCampusPick();
        });
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const dev = ensureDevNamespace();
            const pickState = dev.doorCampusPick;
            if (pickState?.active) {
                cancelDoorCampusPick();
                return;
            }
            clearSelectedDoorCampusPos();
        });
    }

    window.addEventListener('keydown', (event) => {
        const tag = (event.target && event.target.tagName) ? String(event.target.tagName).toUpperCase() : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        if (event.key === 'Escape') cancelDoorCampusPick();
        if (event.key === 'Enter') {
            const dev = ensureDevNamespace();
            const pickState = dev.doorCampusPick;
            if (pickState?.active) confirmDoorCampusPick();
        }
    });

    const dev = ensureDevNamespace();
    dev.updateDoorPositionPanel = updateDoorPositionPanel;
    dev.beginDoorCampusPick = beginDoorCampusPick;
    dev.cancelDoorCampusPick = cancelDoorCampusPick;
    dev.confirmDoorCampusPick = confirmDoorCampusPick;
    dev.setDoorCampusPickPending = setDoorCampusPickPending;
    dev.drawDevOverlays = function() {
        drawCampusDoorMarkerOverlay();
    };

    updateDoorPositionPanel();
})();
