(function () {
    const STYLE_ID = 'wpadminbar-toggle-style';
    const isWpAdmin = window.location.pathname.startsWith('/wp-admin');

    function ensureStyleElement() {
        let style = document.getElementById(STYLE_ID);
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            document.documentElement.appendChild(style);
        }
        return style;
    }

    function applyHide() {
        if (isWpAdmin) return;
        ensureStyleElement().textContent =
            '#wpadminbar { display: none !important; } html { margin-top: 0px !important; }';
    }

    function removeHide() {
        const style = document.getElementById(STYLE_ID);
        if (style) style.textContent = '';
    }

    chrome.storage.sync.get(['wpAdminBarHideOn']).then((data) => {
        if (Boolean(data?.wpAdminBarHideOn)) applyHide();
        else removeHide();
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'sync' || !Object.prototype.hasOwnProperty.call(changes, 'wpAdminBarHideOn')) return;
        if (Boolean(changes.wpAdminBarHideOn.newValue)) applyHide();
        else removeHide();
    });

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (message?.type === 'check-admin-bar') {
            sendResponse({ hasAdminBar: Boolean(document.getElementById('wpadminbar')) });
        }
        return false;
    });
})();
