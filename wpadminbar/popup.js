(function () {
    const toggleEl = document.getElementById('toggle');
    const wpAdminBtn = document.getElementById('wpAdminBtn');

    chrome.storage.sync.get(['wpAdminBarHideOn']).then((state) => {
        toggleEl.checked = Boolean(state?.wpAdminBarHideOn);
    });

    toggleEl.addEventListener('change', function () {
        chrome.storage.sync.set({ wpAdminBarHideOn: toggleEl.checked });
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
        }
    });
})();
