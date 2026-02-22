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

    const waitForApp = window.BMEFind.appReady || Promise.resolve();
    const parts = [
        'js/dev/01-auth-and-ui.js',
        'js/dev/02-editor.js',
        'js/dev/03-export-and-save.js',
        'js/dev/04-door-positions.js'
    ];

    waitForApp
        .then(() => loadScriptSequentially(parts))
        .catch((err) => {
            console.error(err);
            throw err;
        });
})();
