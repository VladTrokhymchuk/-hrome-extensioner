(function () {
    const STYLE_ID = 'wpadminbar-toggle-style';

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
        const style = ensureStyleElement();
        // Hide #wpadminbar and reset html margin-top per requirements
        style.textContent = `#wpadminbar { display: none !important; } html { margin-top: 0px !important; }`;
    }

    function removeHide() {
        const style = document.getElementById(STYLE_ID);
        if (style) {
            style.textContent = '';
        }
    }

    function updateFromState(isOn) {
        if (isOn) {
            applyHide();
        } else {
            removeHide();
        }
    }

    chrome.storage.sync.get(['wpAdminBarHideOn']).then((data) => {
        updateFromState(Boolean(data?.wpAdminBarHideOn));
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName !== 'sync') return;
        if (Object.prototype.hasOwnProperty.call(changes, 'wpAdminBarHideOn')) {
            updateFromState(Boolean(changes.wpAdminBarHideOn.newValue));
            reportIconStatus();
        }
    });

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message && message.type === 'check-admin-bar') {
            const hasAdminBar = Boolean(document.getElementById('wpadminbar'));
            sendResponse({ hasAdminBar });
        }
        return false;
    });

    function reportIconStatus() {
        const hasAdminBar = Boolean(document.getElementById('wpadminbar'));
        chrome.storage.sync.get(['wpAdminBarHideOn']).then((data) => {
            const isHidden = Boolean(data?.wpAdminBarHideOn);
            chrome.runtime.sendMessage({
                type: 'report-admin-status',
                hasAdminBar,
                isHidden
            });
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', reportIconStatus, { once: true });
    } else {
        reportIconStatus();
    }
})();


