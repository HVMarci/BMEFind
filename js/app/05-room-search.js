function createVirtualList(scrollElOrContainerEl, contentElOrRowHeight, rowHeightOrRenderItem, renderItemOrOnItemClick, onItemClick) {
    const usingLegacySignature = typeof contentElOrRowHeight === 'number';
    const scrollEl = scrollElOrContainerEl;
    const contentEl = usingLegacySignature ? scrollElOrContainerEl : contentElOrRowHeight;
    const rowHeight = usingLegacySignature ? contentElOrRowHeight : rowHeightOrRenderItem;
    const renderItem = usingLegacySignature ? rowHeightOrRenderItem : renderItemOrOnItemClick;
    const onClick = usingLegacySignature ? renderItemOrOnItemClick : onItemClick;

    const spacer = document.createElement('div');
    spacer.className = 'virtual-list-spacer';
    contentEl.innerHTML = '';
    contentEl.appendChild(spacer);

    let items = [];
    let selectedIndex = -1;

    const pool = [];
    const buffer = 6;

    function getListOffsetInScrollEl() {
        if (scrollEl === contentEl) return 0;
        const scrollRect = scrollEl.getBoundingClientRect();
        const contentRect = contentEl.getBoundingClientRect();
        return (contentRect.top - scrollRect.top) + scrollEl.scrollTop;
    }

    function ensureIndexVisibleInternal(index) {
        if (index < 0 || index >= items.length) return;
        const listOffset = getListOffsetInScrollEl();
        const itemTop = listOffset + index * rowHeight;
        const itemBottom = itemTop + rowHeight;
        const viewportTop = scrollEl.scrollTop;
        const viewportBottom = viewportTop + (scrollEl.clientHeight || 0);

        const padding = 12;
        if (itemTop < viewportTop + padding) {
            scrollEl.scrollTop = Math.max(0, itemTop - padding);
            render();
            return;
        }
        if (itemBottom > viewportBottom - padding) {
            scrollEl.scrollTop = Math.max(0, itemBottom - (scrollEl.clientHeight || 0) + padding);
            render();
        }
    }

    function render() {
        const scrollTop = scrollEl.scrollTop;
        const viewportHeight = scrollEl.clientHeight || 0;
        const listOffset = getListOffsetInScrollEl();
        const listScrollTop = Math.max(0, scrollTop - listOffset);
        const listViewportTop = Math.max(0, listOffset - scrollTop);
        const listViewportHeight = Math.max(0, viewportHeight - listViewportTop);

        const startIndex = Math.max(0, Math.floor(listScrollTop / rowHeight) - buffer);
        const visibleCount = Math.ceil(listViewportHeight / rowHeight) + buffer * 2;
        const endIndex = Math.min(items.length, startIndex + visibleCount);
        const needed = endIndex - startIndex;

        while (pool.length < needed) {
            const el = document.createElement('div');
            el.className = 'virtual-list-item';
            el.setAttribute('role', 'option');
            el.style.height = `${rowHeight}px`;
            spacer.appendChild(el);
            pool.push(el);
        }
        while (pool.length > needed) {
            const el = pool.pop();
            spacer.removeChild(el);
        }

        for (let i = 0; i < pool.length; i++) {
            const itemIndex = startIndex + i;
            const item = items[itemIndex];
            const el = pool[i];
            el.style.top = `${itemIndex * rowHeight}px`;
            el.setAttribute('aria-selected', itemIndex === selectedIndex ? 'true' : 'false');
            el.classList.toggle('top-match', itemIndex === selectedIndex);
            el.onclick = () => {
                selectedIndex = itemIndex;
                render();
                onClick(itemIndex, item);
            };
            renderItem(el, item, itemIndex);
        }
    }

    scrollEl.addEventListener('scroll', render);
    window.addEventListener('resize', render);

    return {
        setItems(newItems, nextSelectedIndex = -1) {
            items = Array.isArray(newItems) ? newItems : [];
            selectedIndex = nextSelectedIndex;
            spacer.style.height = `${items.length * rowHeight}px`;
            scrollEl.scrollTop = 0;
            render();
        },
        getItems() {
            return items;
        },
        setSelectedIndex(index) {
            selectedIndex = index;
            render();
        },
        getSelectedIndex() {
            return selectedIndex;
        },
        scrollToIndex(index) {
            if (index < 0 || index >= items.length) return;
            const listOffset = getListOffsetInScrollEl();
            scrollEl.scrollTop = listOffset + index * rowHeight;
            render();
        },
        ensureIndexVisible(index) {
            ensureIndexVisibleInternal(index);
        }
    };
}

const roomSearchUI = {
    virtualList: null,
    results: []
};

const ROOM_SEARCH_ROW_HEIGHT = 54;

function updateRoomSearchListHeight(resultsCount) {
    if (!roomSearchList || !roomSearchModal) return;
    roomSearchList.style.height = '';
    return;
}

const floorSortIdCache = new Map();

function getFloorSortIdForRoom(room) {
    const building = room?.building || '';
    const floor = room?.floor ?? '';
    const key = `${building}|${floor}`;
    if (floorSortIdCache.has(key)) return floorSortIdCache.get(key);

    const floorEntry = findFloorByBuildingAndFloor(building, floor);
    const floorId = floorEntry?.id != null ? Number(floorEntry.id) : Number.POSITIVE_INFINITY;
    const safeFloorId = Number.isFinite(floorId) ? floorId : Number.POSITIVE_INFINITY;
    floorSortIdCache.set(key, safeFloorId);
    return safeFloorId;
}

function formatRoomMeta(room) {
    const building = room?.building || '?';
    const floor = room?.floor ?? '?';
    return `${building} - ${floor}`;
}

function renderRoomSearchItem(el, room) {
    if (!el._nameEl) {
        el.innerHTML = '';
        const nameEl = document.createElement('span');
        nameEl.className = 'room-item-name';
        const metaEl = document.createElement('span');
        metaEl.className = 'room-item-meta';
        el.appendChild(nameEl);
        el.appendChild(metaEl);
        el._nameEl = nameEl;
        el._metaEl = metaEl;
    }

    el._nameEl.textContent = room?.room_name || '';
    el._metaEl.textContent = `(${formatRoomMeta(room)})`;
}

function closeRoomSearchModal() {
    if (!roomSearchModal) return;
    roomSearchModal.style.display = 'none';
}

function openRoomSearchModal() {
    if (!roomSearchModal || !roomSearchInput || !roomSearchList || !roomSearchHint) return;

    roomSearchModal.style.display = 'block';
    roomSearchInput.value = '';
    roomSearchHint.textContent = 'Kezdj el gépelni (min. 1 karakter)...';
    roomSearchHint.style.display = '';

    if (!roomSearchUI.virtualList) {
        const modalContentEl = roomSearchModal.querySelector('.modal-content');
        if (!modalContentEl) return;
        roomSearchUI.virtualList = createVirtualList(
            modalContentEl,
            roomSearchList,
            ROOM_SEARCH_ROW_HEIGHT,
            renderRoomSearchItem,
            (index) => selectRoomSearchResult(index)
        );
    }

    roomSearchUI.results = [];
    roomSearchUI.virtualList.setItems([]);
    updateRoomSearchListHeight(0);

    setTimeout(() => roomSearchInput.focus(), 0);
}

window.addEventListener('resize', () => {
    if (roomSearchModal && roomSearchModal.style.display === 'block') {
        updateRoomSearchListHeight(roomSearchUI.results.length);
    }
});

function applyRoomSearchFilter(query) {
    if (!roomSearchUI.virtualList || !roomSearchHint) return;
    const normalized = window.RoomSearch?.normalizeText ? window.RoomSearch.normalizeText(query) : (query || '').trim().toLowerCase();

    if (!normalized || normalized.length < (window.RoomSearch?.MIN_QUERY_LENGTH || 2)) {
        roomSearchUI.results = [];
        roomSearchHint.textContent = 'Kezdj el gépelni (min. 1 karakter)...';
        roomSearchHint.style.display = '';
        roomSearchUI.virtualList.setItems([]);
        updateRoomSearchListHeight(0);
        return;
    }

    const rooms = getRoomSearchRooms();
    const results = [];
    for (const room of rooms) {
        const key = room.room_name_searchKey || '';
        if (key.startsWith(normalized)) results.push(room);
    }

    if (results.length === 0) {
        roomSearchHint.textContent = 'Nincs találat.';
        roomSearchHint.style.display = '';
        roomSearchUI.results = [];
        roomSearchUI.virtualList.setItems([]);
        updateRoomSearchListHeight(0);
        return;
    }

    if (results.length <= 2000) {
        results.sort((a, b) => {
            const buildingCmp = a.building.localeCompare(b.building, 'hu');
            if (buildingCmp !== 0) return buildingCmp;

            const floorIdA = getFloorSortIdForRoom(a);
            const floorIdB = getFloorSortIdForRoom(b);
            if (floorIdA !== floorIdB) return floorIdA - floorIdB;

            const roomCmp = a.room_name.localeCompare(b.room_name, 'hu');
            if (roomCmp !== 0) return roomCmp;

            return Number(a.id) - Number(b.id);
        });
    }

    roomSearchHint.textContent = `Találatok: ${results.length}`;
    roomSearchHint.style.display = '';

    roomSearchUI.results = results;
    roomSearchUI.virtualList.setItems(results, 0);
    updateRoomSearchListHeight(results.length);
}

function selectRoomSearchResult(index) {
    const room = roomSearchUI.results[index];
    if (!room) return;
    if (roomSearchInput) roomSearchInput.value = room.room_name || '';
    closeRoomSearchModal();
    startNavigationToRoom(room);
}

if (roomSearchInput) {
    let debounceTimer = null;
    roomSearchInput.addEventListener('input', () => {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => applyRoomSearchFilter(roomSearchInput.value), 80);
    });

    roomSearchInput.addEventListener('keydown', (e) => {
        if (!roomSearchUI.virtualList) return;
        const results = roomSearchUI.virtualList.getItems();
        const selected = roomSearchUI.virtualList.getSelectedIndex();

        if (e.key === 'Enter') {
            e.preventDefault();
            selectRoomSearchResult(selected >= 0 ? selected : 0);
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const next = selected < 0 ? 0 : Math.min(results.length - 1, selected + 1);
            roomSearchUI.virtualList.setSelectedIndex(next);
            roomSearchUI.virtualList.ensureIndexVisible(next);
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            const next = selected < 0 ? 0 : Math.max(0, selected - 1);
            roomSearchUI.virtualList.setSelectedIndex(next);
            roomSearchUI.virtualList.ensureIndexVisible(next);
        }
    });
}

