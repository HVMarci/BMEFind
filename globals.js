// Shared global data containers (index.html + dev.html)
// Declared here to avoid implicit globals across scripts.

window.BMEFind = window.BMEFind || {};
window.BMEFind.data = window.BMEFind.data || {};

let floorsData = [];
let nodeData = [];
let buildingGraph = {};

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
    }
});

