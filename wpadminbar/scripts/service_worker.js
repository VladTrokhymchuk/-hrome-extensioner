// --- Status config ---

const STATUS = {
    hidden: {
        icon: 'green',
        dotColor: '#4ade80',
        title: 'Адмін-бар прихований\nКлік — показати',
    },
    visible: {
        icon: 'red',
        dotColor: '#f87171',
        title: 'Адмін-бар видимий\nКлік — приховати',
    },
    login: {
        icon: 'def',
        dotColor: '#fbbf24',
        title: 'Не авторизовано\nКлік — відкрити сторінку входу',
    },
    admin: {
        icon: 'def',
        dotColor: '#818cf8',
        title: 'Адмін-панель WordPress\nАдмін-бар завжди видимий',
    },
    inactive: {
        icon: 'def',
        dotColor: null,
        title: 'WP Admin Bar',
    },
};

// --- Icon rendering via OffscreenCanvas ---

const bitmapCache = new Map();

async function getBaseBitmap(size, iconColor) {
    const key = `${size}-${iconColor}`;
    if (bitmapCache.has(key)) return bitmapCache.get(key);
    const suffix = iconColor === 'green' ? '-green' : iconColor === 'red' ? '-red' : '-def';
    const url = chrome.runtime.getURL(`icons/visible-${size}${suffix}.png`);
    const blob = await fetch(url).then(r => r.blob());
    const bitmap = await createImageBitmap(blob);
    bitmapCache.set(key, bitmap);
    return bitmap;
}

async function buildIconImageData(iconColor, dotColor) {
    const sizes = [16, 32, 48, 128];
    const imageData = {};
    await Promise.all(sizes.map(async (size) => {
        const bitmap = await getBaseBitmap(size, iconColor);
        const canvas = new OffscreenCanvas(size, size);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, size, size);

        if (dotColor) {
            const r = Math.max(2, Math.round(size * 0.14));
            const pad = Math.round(size * 0.07);
            const cx = size - r - pad;
            const cy = size - r - pad;

            // white ring for contrast
            ctx.beginPath();
            ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            // colored dot
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = dotColor;
            ctx.fill();
        }

        imageData[size] = ctx.getImageData(0, 0, size, size);
    }));
    return imageData;
}

// --- Helpers ---

function isChromeUrl(urlString) {
    try {
        const { protocol } = new URL(urlString);
        return protocol === 'chrome:' || protocol === 'chrome-extension:';
    } catch (_) {
        return true;
    }
}

function isWpAdminUrl(urlString) {
    try {
        return new URL(urlString).pathname.startsWith('/wp-admin');
    } catch (_) {
        return false;
    }
}

function buildLoginUrl(urlString) {
    try {
        const url = new URL(urlString);
        url.hash = '';
        url.search = '';
        url.pathname = '/wp-login.php';
        return url.toString();
    } catch (_) {
        return null;
    }
}

async function getIsHidden() {
    const data = await chrome.storage.sync.get(['wpAdminBarHideOn']);
    return Boolean(data?.wpAdminBarHideOn);
}

async function checkAdminBarInTab(tabId) {
    try {
        const resp = await chrome.tabs.sendMessage(tabId, { type: 'check-admin-bar' });
        return Boolean(resp?.hasAdminBar);
    } catch (_) {
        return false;
    }
}

async function resolveStatus(tab) {
    if (!tab?.url || isChromeUrl(tab.url)) return 'inactive';
    if (isWpAdminUrl(tab.url)) return 'admin';
    const hasAdminBar = await checkAdminBarInTab(tab.id);
    if (!hasAdminBar) return 'login';
    return (await getIsHidden()) ? 'hidden' : 'visible';
}

async function applyStatusToTab(tabId, statusKey) {
    const s = STATUS[statusKey];
    const imageData = await buildIconImageData(s.icon, s.dotColor);
    await Promise.allSettled([
        chrome.action.setIcon({ imageData, tabId }),
        chrome.action.setBadgeText({ text: '', tabId }),
        chrome.action.setTitle({ title: s.title, tabId }),
    ]);
}

async function updateTab(tab) {
    if (!tab?.id || !tab.url) return;
    const status = await resolveStatus(tab);
    await applyStatusToTab(tab.id, status);
}

async function updateAllTabs() {
    try {
        const tabs = await chrome.tabs.query({});
        await Promise.all(tabs.map(updateTab));
    } catch (_) { }
}

// --- Click handler ---

chrome.action.onClicked.addListener(async (tab) => {
    if (!tab?.id || !tab.url) return;
    if (isChromeUrl(tab.url)) return;
    if (isWpAdminUrl(tab.url)) return;

    const hasAdminBar = await checkAdminBarInTab(tab.id);
    if (hasAdminBar) {
        await chrome.storage.sync.set({ wpAdminBarHideOn: !(await getIsHidden()) });
    } else {
        const loginUrl = buildLoginUrl(tab.url);
        if (loginUrl) chrome.tabs.update(tab.id, { url: loginUrl });
    }
});

// --- Lifecycle ---

chrome.runtime.onInstalled.addListener(updateAllTabs);
chrome.runtime.onStartup.addListener(updateAllTabs);

chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'sync' && 'wpAdminBarHideOn' in changes) {
        await updateAllTabs();
    }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
        const tab = await chrome.tabs.get(tabId);
        await updateTab(tab);
    } catch (_) { }
});

chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        await updateTab(tab);
    }
});
