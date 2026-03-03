// Shared global data containers (index.html + dev.html)
// Declared here to avoid implicit globals across scripts.

window.BMEFind = window.BMEFind || {};
window.BMEFind.data = window.BMEFind.data || {};
window.BMEFind.ui = window.BMEFind.ui || {};

window.BMEFind.ui.isMobilePlatform = function isMobilePlatform() {
    const uaData = navigator.userAgentData;
    if (uaData && typeof uaData.mobile === 'boolean') return uaData.mobile;

    const ua = String(navigator.userAgent || '');
    if (/(android|iphone|ipad|ipod|iemobile|windows phone|webos|blackberry|opera mini)/i.test(ua)) return true;

    // iPadOS may present as Macintosh in some modes.
    if (/macintosh/i.test(ua) && navigator.maxTouchPoints && navigator.maxTouchPoints > 1) return true;

    return false;
};

(function applyPlatformDataset() {
    try {
        const platform = window.BMEFind.ui.isMobilePlatform() ? 'mobile' : 'desktop';
        document.documentElement.dataset.bmePlatform = platform;
    } catch (_) {
        document.documentElement.dataset.bmePlatform = 'desktop';
    }
})();

let floorsData = [];
let nodeData = [];
let buildingGraph = {};
let buildingsData = [];

Object.defineProperties(window.BMEFind.data, {
    floorsData: {
        get() { return floorsData; },
        set(v) { floorsData = Array.isArray(v) ? v : []; }
    },
    nodeData: {
        get() { return nodeData; },
        set(v) { nodeData = Array.isArray(v) ? v : []; }
    },
    buildingGraph: {
        get() { return buildingGraph; },
        set(v) { buildingGraph = v && typeof v === 'object' ? v : {}; }
    },
    buildingsData: {
        get() { return buildingsData; },
        set(v) { buildingsData = Array.isArray(v) ? v : []; }
    }
});

(function setupVisualViewportHelpers() {
    const root = document.documentElement;

    function updateVisualViewportVars() {
        const vv = window.visualViewport;
        const width = vv ? vv.width : window.innerWidth;
        const height = vv ? vv.height : window.innerHeight;
        const offsetTop = vv ? vv.offsetTop : 0;
        const offsetLeft = vv ? vv.offsetLeft : 0;

        root.style.setProperty('--bme-vv-width', `${Math.round(width)}px`);
        root.style.setProperty('--bme-vv-height', `${Math.round(height)}px`);
        root.style.setProperty('--bme-vv-offset-top', `${Math.round(offsetTop)}px`);
        root.style.setProperty('--bme-vv-offset-left', `${Math.round(offsetLeft)}px`);

        const keyboardLikelyOpen = vv
            ? (window.innerHeight - vv.height) > 120
            : false;
        root.dataset.bmeKeyboard = keyboardLikelyOpen ? 'open' : 'closed';
    }

    updateVisualViewportVars();
    window.BMEFind.ui.updateVisualViewportVars = updateVisualViewportVars;

    window.addEventListener('resize', updateVisualViewportVars);
    window.addEventListener('orientationchange', updateVisualViewportVars);

    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', updateVisualViewportVars);
        window.visualViewport.addEventListener('scroll', updateVisualViewportVars);
    }

    document.addEventListener('focusin', (event) => {
        const target = event.target;
        if (!target || typeof target.closest !== 'function') return;
        const modal = target.closest('.modal');
        if (!modal) return;

        updateVisualViewportVars();
        setTimeout(() => {
            updateVisualViewportVars();
            if (typeof target.scrollIntoView === 'function') {
                try {
                    target.scrollIntoView({ block: 'center', inline: 'nearest' });
                } catch (_) {
                    target.scrollIntoView();
                }
            }
        }, 50);
    }, { passive: true });
})();

(function setupSharedModalHelpers() {
    window.BMEFind = window.BMEFind || {};
    window.BMEFind.ui = window.BMEFind.ui || {};

    if (window.BMEFind.ui.modal) return;

    function isModalOpen(modalEl) {
        if (!modalEl) return false;
        const display = modalEl.style?.display;
        if (display && display !== 'none') return true;
        return window.getComputedStyle(modalEl).display !== 'none';
    }

    function openModal(modalEl) {
        if (!modalEl) return;
        modalEl.style.display = 'flex';
    }

    function closeModal(modalEl) {
        if (!modalEl) return;
        modalEl.style.display = 'none';
    }

    function ensureToastContainer() {
        let container = document.getElementById('bmeToastContainer');
        if (container) return container;

        container = document.createElement('div');
        container.id = 'bmeToastContainer';
        container.className = 'bme-toast-container';
        container.setAttribute('aria-live', 'polite');
        container.setAttribute('aria-relevant', 'additions');
        (document.body || document.documentElement).appendChild(container);
        return container;
    }

    function toast(message, options = {}) {
        const { type = 'info', durationMs = 2600, bgColor = null } = options;
        const container = ensureToastContainer();

        const el = document.createElement('div');
        el.className = `bme-toast bme-toast-${type}`;
        el.setAttribute('role', 'status');
        el.textContent = String(message ?? '');
        if (bgColor) {
            el.style.backgroundColor = String(bgColor);
        }
        container.appendChild(el);

        const duration = Math.max(500, Number(durationMs) || 2600);
        window.setTimeout(() => {
            el.classList.add('bme-toast-hide');
            window.setTimeout(() => el.remove(), 200);
        }, duration);
    }

    function ensureSystemModal() {
        let modal = document.getElementById('bmeSystemModal');
        if (modal) return modal;

        modal = document.createElement('div');
        modal.id = 'bmeSystemModal';
        modal.className = 'modal';

        modal.innerHTML = `
            <div class="modal-content modal-small">
                <div class="modal-header">
                    <h3 id="bmeSystemModalTitle">Üzenet</h3>
                    <span class="close" data-modal="bmeSystemModal">&times;</span>
                </div>
                <div id="bmeSystemModalBody" class="bme-modal-body"></div>
                <div id="bmeSystemModalInputWrap" class="bme-modal-input" style="display: none;">
                    <input id="bmeSystemModalInput" type="text" autocomplete="off" />
                </div>
                <div id="bmeSystemModalActions" class="bme-modal-actions"></div>
            </div>
        `.trim();

        (document.body || document.documentElement).appendChild(modal);
        return modal;
    }

    let activeSystemModal = null;
    const systemModalQueue = [];
    let systemModalBusy = false;

    const TYPE_COLORS = Object.freeze({
        info: '#007bff',
        success: '#28a745',
        warning: '#ffc107',
        error: '#dc3545'
    });

    function showSystemModal(options) {
        const {
            title = 'Üzenet',
            message = '',
            kind = 'alert', // alert | confirm | prompt
            type = 'info', // info | success | warning | error
            barColor = null,
            okText = 'OK',
            cancelText = 'Mégse',
            inputValue = '',
            inputPlaceholder = '',
            inputType = 'text'
        } = options || {};

        const normalizedKind = String(kind || 'alert').toLowerCase();
        const normalizedType = String(type || 'info').toLowerCase();

        // If an error alert is already open, coalesce further error alerts into it.
        if (
            activeSystemModal &&
            activeSystemModal.kind === 'alert' &&
            activeSystemModal.type === 'error' &&
            normalizedKind === 'alert' &&
            normalizedType === 'error'
        ) {
            const modal = ensureSystemModal();
            const titleEl = modal.querySelector('#bmeSystemModalTitle');
            const bodyEl = modal.querySelector('#bmeSystemModalBody');
            const headerEl = modal.querySelector('.modal-header');

            const nextTitle = String(title ?? '');
            const nextMessage = String(message ?? '');

            if (titleEl && nextTitle) titleEl.textContent = nextTitle;
            if (bodyEl && nextMessage) {
                const current = String(bodyEl.textContent || '');
                if (!current.includes(nextMessage)) {
                    bodyEl.textContent = current ? (current + '\n\n' + nextMessage) : nextMessage;
                }
            }
            if (headerEl) headerEl.style.borderBottomColor = TYPE_COLORS.error;

            return activeSystemModal.promise;
        }

        return new Promise((resolve) => {
            systemModalQueue.push({
                options: {
                    title,
                    message,
                    kind: normalizedKind,
                    type: normalizedType,
                    barColor,
                    okText,
                    cancelText,
                    inputValue,
                    inputPlaceholder,
                    inputType
                },
                resolve
            });

            if (!systemModalBusy) {
                systemModalBusy = true;
                pumpSystemModalQueue();
            }
        });
    }

    function pumpSystemModalQueue() {
        if (activeSystemModal) return;

        const next = systemModalQueue.shift();
        if (!next) {
            systemModalBusy = false;
            return;
        }

        const opts = next.options || {};
        const modal = ensureSystemModal();
        const titleEl = modal.querySelector('#bmeSystemModalTitle');
        const bodyEl = modal.querySelector('#bmeSystemModalBody');
        const inputWrapEl = modal.querySelector('#bmeSystemModalInputWrap');
        const inputEl = modal.querySelector('#bmeSystemModalInput');
        const actionsEl = modal.querySelector('#bmeSystemModalActions');
        const closeBtn = modal.querySelector('.close');
        const headerEl = modal.querySelector('.modal-header');

        const previouslyFocused = document.activeElement;

        titleEl.textContent = String(opts.title ?? '');
        bodyEl.textContent = String(opts.message ?? '');

        const resolvedType = String(opts.type || 'info').toLowerCase();
        const resolvedBarColor = opts.barColor || TYPE_COLORS[resolvedType] || TYPE_COLORS.info;
        if (headerEl) headerEl.style.borderBottomColor = String(resolvedBarColor);

        const wantsInput = opts.kind === 'prompt';
        inputWrapEl.style.display = wantsInput ? 'block' : 'none';
        inputEl.value = wantsInput ? String(opts.inputValue ?? '') : '';
        inputEl.placeholder = wantsInput ? String(opts.inputPlaceholder ?? '') : '';
        inputEl.type = wantsInput ? String(opts.inputType || 'text') : 'text';

        actionsEl.innerHTML = '';

        function finish(result) {
            closeModal(modal);
            modal.removeEventListener('click', onBackdropClick);
            document.removeEventListener('keydown', onKeydown, true);
            closeBtn?.removeEventListener('click', onCloseClick);
            inputEl?.removeEventListener('keydown', onInputKeydown);

            const resolve = activeSystemModal?.resolve;
            activeSystemModal = null;

            if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
                try { previouslyFocused.focus(); } catch (_) {}
            }

            if (typeof resolve === 'function') resolve(result);
            pumpSystemModalQueue();
        }

        function onCloseClick(event) {
            event.preventDefault();
            if (opts.kind === 'confirm') return finish(false);
            if (opts.kind === 'prompt') return finish(null);
            return finish(null);
        }

        function onBackdropClick(event) {
            if (event.target !== modal) return;
            if (opts.kind === 'confirm') return finish(false);
            if (opts.kind === 'prompt') return finish(null);
            return finish(null);
        }

        function onKeydown(event) {
            if (event.key !== 'Escape') return;
            if (!isModalOpen(modal)) return;
            event.preventDefault();
            if (opts.kind === 'confirm') return finish(false);
            if (opts.kind === 'prompt') return finish(null);
            return finish(null);
        }

        function onInputKeydown(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                finish(String(inputEl.value ?? ''));
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                finish(null);
            }
        }

        const okBtn = document.createElement('button');
        okBtn.type = 'button';
        okBtn.className = 'btn-primary btn-success';
        okBtn.textContent = opts.okText || 'OK';
        okBtn.addEventListener('click', () => {
            if (opts.kind === 'prompt') return finish(String(inputEl.value ?? ''));
            if (opts.kind === 'confirm') return finish(true);
            return finish(null);
        });

        if (opts.kind === 'confirm' || opts.kind === 'prompt') {
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn-primary btn-danger';
            cancelBtn.textContent = opts.cancelText || 'Mégse';
            cancelBtn.addEventListener('click', () => finish(opts.kind === 'confirm' ? false : null));
            actionsEl.appendChild(cancelBtn);
        }

        actionsEl.appendChild(okBtn);

        closeBtn?.addEventListener('click', onCloseClick);
        modal.addEventListener('click', onBackdropClick);
        document.addEventListener('keydown', onKeydown, true);
        if (wantsInput) inputEl?.addEventListener('keydown', onInputKeydown);

        openModal(modal);

        window.setTimeout(() => {
            if (wantsInput) {
                inputEl?.focus();
                inputEl?.select?.();
            } else {
                okBtn?.focus();
            }
        }, 0);

        const promise = new Promise((resolve) => {
            activeSystemModal = {
                resolve,
                kind: opts.kind,
                type: resolvedType,
                promise: null
            };
        });

        // Expose promise for error-coalescing.
        if (activeSystemModal) activeSystemModal.promise = promise;

        promise.then(next.resolve);
    }

    async function alertModal(message, options = {}) {
        await showSystemModal({
            ...options,
            kind: 'alert',
            message
        });
    }

    async function confirmModal(message, options = {}) {
        const result = await showSystemModal({
            ...options,
            kind: 'confirm',
            message
        });
        return Boolean(result);
    }

    async function promptModal(message, defaultValue = '', options = {}) {
        const result = await showSystemModal({
            ...options,
            kind: 'prompt',
            message,
            inputValue: defaultValue
        });
        if (result === null) return null;
        return String(result);
    }

    window.BMEFind.ui.modal = {
        isOpen: isModalOpen,
        open: openModal,
        close: closeModal,
        toast,
        alert: alertModal,
        confirm: confirmModal,
        prompt: promptModal
    };
})();

