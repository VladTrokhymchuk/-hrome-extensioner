// function updateIcon(isOn) {
//     const path = isOn
//         ? {
//             "16": "icons/hidden-16-red.png",
//             "32": "icons/hidden-32-red.png",
//             "48": "icons/hidden-48-red.png",
//             "128": "icons/hidden-128-red.png"
//         }
//         : {
//             "16": "icons/visible-16.png",
//             "32": "icons/visible-32.png",
//             "48": "icons/visible-48.png",
//             "128": "icons/visible-128.png"
//         };

//     chrome.action.setIcon({ path });
// }

// // при запуску
// chrome.runtime.onInstalled.addListener(() => {
//     chrome.storage.sync.get(["wpAdminBarHideOn"]).then((data) => {
//         updateIcon(Boolean(data?.wpAdminBarHideOn));
//     });
// });

// // при зміні стану
// chrome.storage.onChanged.addListener((changes, areaName) => {
//     if (areaName === "sync" && changes.wpAdminBarHideOn) {
//         updateIcon(Boolean(changes.wpAdminBarHideOn.newValue));
//     }
// });


// // // додаэ квадр над іконкою і передає колір статусу
// // function updateActionBackground(isOn) {
// //     if (isOn) {
// //         chrome.action.setBadgeBackgroundColor({ color: "#22c55e" }); // зелений
// //         chrome.action.setBadgeText({ text: " " }); // пробіл, щоб фон був видимий
// //     } else {
// //         chrome.action.setBadgeBackgroundColor({ color: "#ef4444" }); // червоний
// //         chrome.action.setBadgeText({ text: " " });
// //     }
// // }

// // // при запуску
// // chrome.runtime.onInstalled.addListener(() => {
// //     chrome.storage.sync.get(["wpAdminBarHideOn"]).then((data) => {
// //         updateActionBackground(Boolean(data?.wpAdminBarHideOn));
// //     });
// // });

// // // при зміні стану
// // chrome.storage.onChanged.addListener((changes, areaName) => {
// //     if (areaName === "sync" && changes.wpAdminBarHideOn) {
// //         updateActionBackground(Boolean(changes.wpAdminBarHideOn.newValue));
// //     }
// // });

function getIconPathForStatus(status) {
    if (status === 'red') {
        return {
            "16": "icons/visible-16-red.png",
            "32": "icons/visible-32-red.png",
            "48": "icons/visible-48-red.png",
            "128": "icons/visible-128-red.png"
        };
    }
    if (status === 'green') {
        return {
            "16": "icons/visible-16-green.png",
            "32": "icons/visible-32-green.png",
            "48": "icons/visible-48-green.png",
            "128": "icons/visible-128-green.png"
        };
    }
    return {
        "16": "icons/visible-16-def.png",
        "32": "icons/visible-32-def.png",
        "48": "icons/visible-48-def.png",
        "128": "icons/visible-128-def.png"
    };
}

async function detectAdminBarInTab(tabId) {
    try {
        const resp = await chrome.tabs.sendMessage(tabId, { type: 'check-admin-bar' });
        return Boolean(resp && resp.hasAdminBar);
    } catch (_) {
        return false;
    }
}

async function computeStatusForTab(tab) {
    try {
        const url = new URL(tab.url || '');
        if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
            return 'def';
        }
    } catch (_) {
        return 'def';
    }

    const hasAdminBar = await detectAdminBarInTab(tab.id);
    const data = await chrome.storage.sync.get(["wpAdminBarHideOn"]);
    const isHidden = Boolean(data?.wpAdminBarHideOn);

    // Reflect stored state even if admin bar is absent
    return isHidden ? 'green' : 'red';
}

async function updateActionIconForTab(tab) {
    if (!tab || !tab.id) return;
    const status = await computeStatusForTab(tab);
    const path = getIconPathForStatus(status);
    chrome.action.setIcon({ path, tabId: tab.id }).catch(() => { });
}

async function updateActionIconForActiveTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) await updateActionIconForTab(tab);
    } catch (_) { }
}

async function updateActionIconForAllTabs() {
    try {
        const tabs = await chrome.tabs.query({});
        await Promise.all(tabs.map((tab) => updateActionIconForTab(tab)));
    } catch (_) { }
}

async function updateGlobalIconFromStorage() {
    try {
        const data = await chrome.storage.sync.get(["wpAdminBarHideOn"]);
        const isHidden = Boolean(data?.wpAdminBarHideOn);
        const path = getIconPathForStatus(isHidden ? 'green' : 'red');
        await chrome.action.setIcon({ path });
    } catch (_) { }
}

chrome.runtime.onInstalled.addListener(updateActionIconForActiveTab);
chrome.runtime.onStartup.addListener(updateActionIconForActiveTab);

chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === "sync" && changes.wpAdminBarHideOn) {
        await Promise.all([
            updateActionIconForAllTabs(),
            updateGlobalIconFromStorage()
        ]);
    }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
    try {
        const tab = await chrome.tabs.get(tabId);
        await updateActionIconForTab(tab);
    } catch (_) { }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' || changeInfo.url) {
        await updateActionIconForTab(tab);
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message && message.type === 'report-admin-status') {
        (async () => {
            try {
                const tabId = sender?.tab?.id;
                if (!tabId) return;
                const data = await chrome.storage.sync.get(["wpAdminBarHideOn"]);
                const isHidden = Boolean(data?.wpAdminBarHideOn);
                const status = isHidden ? 'green' : 'red';
                const path = getIconPathForStatus(status);
                chrome.action.setIcon({ path, tabId }).catch(() => { });
            } catch (_) { }
        })();
    }
});

async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
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

async function handleActionClick() {
    const tab = await getActiveTab();
    if (!tab || !tab.id || !tab.url) return;

    let hasAdminBar = false;
    try {
        const resp = await chrome.tabs.sendMessage(tab.id, { type: 'check-admin-bar' });
        hasAdminBar = Boolean(resp && resp.hasAdminBar);
    } catch (_) {
        hasAdminBar = false;
    }

    if (hasAdminBar) {
        const data = await chrome.storage.sync.get(["wpAdminBarHideOn"]);
        const next = !Boolean(data?.wpAdminBarHideOn);
        await chrome.storage.sync.set({ wpAdminBarHideOn: next });
        await updateActionIconForTab(tab);
    } else {
        const target = buildWpAdminUrlFrom(tab.url);
        if (target) {
            chrome.tabs.update(tab.id, { url: target });
        }
    }
}

chrome.action.onClicked.addListener(() => {
    handleActionClick();
});