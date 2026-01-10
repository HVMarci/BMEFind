function applyModalSearchFilter(listEl, query, getText) {
    if (!listEl) return;
    const normalizedQuery = (query || '').trim().toLowerCase();
    Array.from(listEl.children).forEach(li => {
        const haystack = (getText(li) || '').toLowerCase();
        li.style.display = normalizedQuery === '' || haystack.includes(normalizedQuery) ? '' : 'none';
    });
    updateTopMatch(listEl);
}

function updateTopMatch(listEl) {
    if (!listEl) return;
    Array.from(listEl.children).forEach(li => li.classList.remove('top-match'));
    const firstVisible = Array.from(listEl.children).find(li => li.style.display !== 'none');
    if (firstVisible) firstVisible.classList.add('top-match');
}

function getVisibleModalItems(listEl) {
    if (!listEl) return [];
    return Array.from(listEl.children).filter(li => li.style.display !== 'none');
}

function getSelectedVisibleIndex(listEl) {
    const visible = getVisibleModalItems(listEl);
    if (visible.length === 0) return -1;
    const idx = visible.findIndex(li => li.classList.contains('top-match'));
    return idx >= 0 ? idx : 0;
}

function setSelectedVisibleIndex(listEl, visibleIndex) {
    const visible = getVisibleModalItems(listEl);
    if (visible.length === 0) return;
    const clamped = Math.max(0, Math.min(visible.length - 1, visibleIndex));

    Array.from(listEl.children).forEach(li => li.classList.remove('top-match'));
    const selected = visible[clamped];
    selected.classList.add('top-match');
    selected.scrollIntoView({ block: 'nearest' });
}

function openBuildingSelectorModal() {
    if (!buildingModal || !buildingList) return;

    buildingList.innerHTML = '';
    if (buildingSearch) buildingSearch.value = '';

    const byBuilding = new Map();
    floorsData.forEach(b => {
        if (b.building === 'KAMPUSZ') return;
        if (!byBuilding.has(b.building)) byBuilding.set(b.building, []);
        byBuilding.get(b.building).push(b);
    });

    const buildings = Array.from(byBuilding.entries())
        .map(([building, floors]) => ({ building, floors }))
        .sort((a, b) => a.building.localeCompare(b.building, 'hu'));

    buildings.forEach(({ building, floors }) => {
        const li = document.createElement('li');
        li.className = 'building-item';
        li.setAttribute('data-building', building);
        if (currentFloor?.building === building) {
            li.classList.add('current');
        }

        const nameDiv = document.createElement('div');
        nameDiv.className = 'building-name';
        nameDiv.textContent = building;

        const fileDiv = document.createElement('div');
        fileDiv.className = 'building-file';
        const floorNames = sortFloorsById(floors.slice()).map(f => f.floor);
        const preview = floorNames.length > 8 ? `${floorNames.slice(0, 8).join(', ')}, ...` : floorNames.join(', ');
        fileDiv.textContent = preview;

        li.appendChild(nameDiv);
        li.appendChild(fileDiv);

        li.addEventListener('click', async () => {
            const targetFloor = chooseFloorForBuildingSelection(building);
            if (targetFloor) {
                await applyFloorSelection(targetFloor);
            }
            buildingModal.style.display = 'none';
            if (typeof closeSidebarOnMobile === 'function') closeSidebarOnMobile();
        });

        buildingList.appendChild(li);
    });

    buildingModal.style.display = 'block';
    updateTopMatch(buildingList);
    if (buildingSearch) buildingSearch.focus();
}

function openFloorSelectorModal() {
    if (!floorModal || !floorList) return;
    if (!currentFloor?.building || isCampusFloor(currentFloor)) return;

    floorList.innerHTML = '';
    if (floorSearch) floorSearch.value = '';

    const floors = sortFloorsById(getBuildingFloors(currentFloor.building));
    floors.forEach(floor => {
        const li = document.createElement('li');
        li.className = 'building-item';
        li.setAttribute('data-floor-id', floor.id);
        if (floor.id === currentFloor?.id) {
            li.classList.add('current');
        }

        const nameDiv = document.createElement('div');
        nameDiv.className = 'building-name';
        nameDiv.textContent = floor.floor;

        const fileDiv = document.createElement('div');
        fileDiv.className = 'building-file';
        fileDiv.textContent = floor.filename;

        li.appendChild(nameDiv);
        li.appendChild(fileDiv);

        li.addEventListener('click', async () => {
            await applyFloorSelection(floor);
            floorModal.style.display = 'none';
            if (typeof closeSidebarOnMobile === 'function') closeSidebarOnMobile();
        });

        floorList.appendChild(li);
    });

    floorModal.style.display = 'block';
    updateTopMatch(floorList);
    if (floorSearch) floorSearch.focus();
}

function updateFloorControls() {
    if (floorSelectorBtn) {
        const disabled = !currentFloor?.building || isCampusFloor(currentFloor);
        floorSelectorBtn.disabled = disabled;
        floorSelectorBtn.className = disabled ? 'disabled' : 'primary btn-selector';
    }

    if (!floorQuickButtons) return;
    floorQuickButtons.innerHTML = '';

    if (!currentFloor?.building || isCampusFloor(currentFloor)) return;

    const floors = sortFloorsById(getBuildingFloors(currentFloor.building));
    const idx = floors.findIndex(f => f.id === currentFloor?.id);
    if (idx < 0) return;

    const upBtn = document.createElement('button');
    upBtn.type = 'button';
    upBtn.className = 'floor-control-btn';
    upBtn.setAttribute('aria-label', 'Szint fel');
    upBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l-7 7h4v9h6v-9h4z"/></svg>';
    upBtn.disabled = idx >= floors.length - 1;
    upBtn.classList.toggle('invisible', upBtn.disabled);
    upBtn.addEventListener('click', async () => {
        if (upBtn.disabled) return;
        await applyFloorSelection(floors[idx + 1]);
    });

    const indicatorBtn = document.createElement('button');
    indicatorBtn.type = 'button';
    indicatorBtn.className = 'floor-control-btn indicator';
    indicatorBtn.setAttribute('aria-label', 'Szint vÄ‚Ë‡lasztÄ‚Ĺ‚');
    indicatorBtn.textContent = currentFloor.floor ?? '?';
    indicatorBtn.addEventListener('click', () => openFloorSelectorModal());

    const downBtn = document.createElement('button');
    downBtn.type = 'button';
    downBtn.className = 'floor-control-btn';
    downBtn.setAttribute('aria-label', 'Szint le');
    downBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20l7-7h-4V4H9v9H5z"/></svg>';
    downBtn.disabled = idx <= 0;
    downBtn.classList.toggle('invisible', downBtn.disabled);
    downBtn.addEventListener('click', async () => {
        if (downBtn.disabled) return;
        await applyFloorSelection(floors[idx - 1]);
    });

    floorQuickButtons.appendChild(upBtn);
    floorQuickButtons.appendChild(indicatorBtn);
    floorQuickButtons.appendChild(downBtn);
}

// Keep floor UI in sync with floor changes
window.onCurrentFloorChanged = function() {
    updateFloorControls();
};
updateFloorControls();

if (buildingSelectorBtn) {
    buildingSelectorBtn.addEventListener('click', () => {
        openBuildingSelectorModal();
    });
}

if (floorSelectorBtn) {
    floorSelectorBtn.addEventListener('click', () => {
        if (floorSelectorBtn.disabled) return;
        openFloorSelectorModal();
    });
}

if (buildingSearch && buildingList) {
    buildingSearch.addEventListener('input', () => {
        applyModalSearchFilter(buildingList, buildingSearch.value, (li) => li.getAttribute('data-building') || '');
    });
    buildingSearch.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const idx = getSelectedVisibleIndex(buildingList);
            if (idx >= 0) setSelectedVisibleIndex(buildingList, idx + 1);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const idx = getSelectedVisibleIndex(buildingList);
            if (idx >= 0) setSelectedVisibleIndex(buildingList, idx - 1);
            return;
        }
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const visible = getVisibleModalItems(buildingList);
        const idx = getSelectedVisibleIndex(buildingList);
        const selected = idx >= 0 ? visible[idx] : null;
        if (selected) selected.click();
    });
}

if (floorSearch && floorList) {
    floorSearch.addEventListener('input', () => {
        applyModalSearchFilter(floorList, floorSearch.value, (li) => li.querySelector('.building-name')?.textContent || '');
    });
    floorSearch.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const idx = getSelectedVisibleIndex(floorList);
            if (idx >= 0) setSelectedVisibleIndex(floorList, idx + 1);
            return;
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const idx = getSelectedVisibleIndex(floorList);
            if (idx >= 0) setSelectedVisibleIndex(floorList, idx - 1);
            return;
        }
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const visible = getVisibleModalItems(floorList);
        const idx = getSelectedVisibleIndex(floorList);
        const selected = idx >= 0 ? visible[idx] : null;
        if (selected) selected.click();
    });
}

