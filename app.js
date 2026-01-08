// Auto-generated loader (see tools/split_frontend_js.mjs)
(function() {
    window.BMEFind = window.BMEFind || {};

    function loadScriptSequentially(srcs) {
        let p = Promise.resolve();
        for (const src of srcs) {
            p = p.then(() => new Promise((resolve, reject) => {
                const el = document.createElement('script');
                el.src = src;
                el.async = false;
                el.onload = () => resolve();
                el.onerror = () => reject(new Error('Failed to load ' + src));
                document.head.appendChild(el);
            }));
        }
        return p;
    }

    const parts = [
        'js/app/01-dom.js',
        'js/app/02-state-and-data.js',
        'js/app/03-floor-ui.js',
        'js/app/04-map-and-navigation.js',
        'js/app/05-room-search.js',
        'js/app/06-runtime.js'
    ];

    window.BMEFind['appReady'] = loadScriptSequentially(parts)
        .catch((err) => {
            console.error(err);
            throw err;
        });
})();
