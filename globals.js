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

