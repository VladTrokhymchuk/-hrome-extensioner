(function () {
    const toggleEl = document.getElementById('toggle');
    const wpAdminBtn = document.getElementById('wpAdminBtn');

    function updateActionIcon(isOn) {
        const path = isOn
            ? {
                "16": "icons/visible-16-red.png",
                "32": "icons/visible-32-red.png",
                "48": "icons/visible-48-red.png",
                "128": "icons/visible-128-red.png"
            }
            : {
                "16": "icons/visible-16-def.png",
                "32": "icons/visible-32-def.png",
                "48": "icons/visible-48-def.png",
                "128": "icons/visible-128-def.png"
            };
        try {
            chrome.action.setIcon({ path });
        } catch (_) { /* noop */ }
    }

    function setToggleCheckedFromState(state) {
        const isOn = Boolean(state?.wpAdminBarHideOn);
        toggleEl.checked = isOn;
        updateActionIcon(isOn);
    }

    chrome.storage.sync.get(['wpAdminBarHideOn']).then(setToggleCheckedFromState);

    toggleEl.addEventListener('change', async function () {
        const isOn = toggleEl.checked;
        await chrome.storage.sync.set({ wpAdminBarHideOn: isOn });
        updateActionIcon(isOn);
    });

    async function getActiveTabUrl() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab?.url || '';
    }

    function buildWpAdminUrlFrom(urlString) {
        try {
            const url = new URL(urlString);
            if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') return null;
            url.hash = '';
            url.search = '';
            url.pathname = '/wp-admin/';
            return url.toString();
        } catch (_) {
            return null;
        }
    }

    wpAdminBtn?.addEventListener('click', async function () {
        const currentUrl = await getActiveTabUrl();
        const target = buildWpAdminUrlFrom(currentUrl);
        if (target) {
            chrome.tabs.create({ url: target });
        } else {
            // Fallback: open generic wp-admin to let user adjust
            chrome.tabs.create({ url: 'https://example.com/wp-admin/' });
        }
    });
})();


