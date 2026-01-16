var browser = browser || chrome;

const defaultConfig = [
    { url: "https://archlinux.org", pinned: true, muted: false },
    { url: "https://news.ycombinator.com", pinned: false, muted: false }
];

async function restoreTabs() {
    try {
        const data = await browser.storage.local.get(["savedTabs", "closeOtherTabs"]);
        const configTabs = data.savedTabs || defaultConfig;
        const shouldCloseOthers = data.closeOtherTabs || false;

        if (configTabs.length === 0) return;

        const currentWindow = await browser.windows.getCurrent();
        const currentTabs = await browser.tabs.query({ windowId: currentWindow.id });

        const normalize = (url) => {
            if (!url || url === "about:newtab" || url === "chrome://newtab/") return "kJ_NEW_TAB_kJ";
            try {
                const u = new URL(url);
                let host = u.hostname.replace(/^www\./, "");
                let path = u.pathname.replace(/\/$/, "");
                return host + path + u.search + u.hash;
            } catch (e) {
                return url.replace(/\/$/, "");
            }
        };

        const reusedTabIds = new Set();
        const finalTabIds = [];

        for (let i = 0; i < configTabs.length; i++) {
            const target = configTabs[i];
            const targetNorm = normalize(target.url);

            const urlToOpen = target.url || undefined;

            const existingTab = currentTabs.find(t => {
                if (reusedTabIds.has(t.id)) return false;
                return normalize(t.url) === targetNorm;
            });

            if (existingTab) {
                reusedTabIds.add(existingTab.id);
                finalTabIds.push(existingTab.id);

                await browser.tabs.move(existingTab.id, { index: i });

                await browser.tabs.update(existingTab.id, {
                    pinned: target.pinned,
                    muted: target.muted
                });

                if (target.focus) {
                    await browser.tabs.update(existingTab.id, { active: true });
                }
            } else {
                const isActive = target.focus || false;
                const newTab = await browser.tabs.create({
                    url: urlToOpen,
                    index: i,
                    pinned: target.pinned,
                    active: isActive,
                    windowId: currentWindow.id
                });
                finalTabIds.push(newTab.id);

                if (target.muted) {
                    await browser.tabs.update(newTab.id, { muted: true });
                }
            }
        }

        if (shouldCloseOthers) {
            const allTabsNow = await browser.tabs.query({ windowId: currentWindow.id });

            const tabsToRemove = allTabsNow
                .filter(t => !finalTabIds.includes(t.id))
                .filter(t => !t.url.startsWith(browser.runtime.getURL("")))
                .map(t => t.id);

            if (tabsToRemove.length > 0) {
                await browser.tabs.remove(tabsToRemove);
            }
        }
    } catch (e) {
        console.error("Error restoring tabs:", e);
    }
}

browser.runtime.onStartup.addListener(restoreTabs);

browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
        const data = await browser.storage.local.get("hasShownInstallPage");
        const currentStored = await browser.storage.local.get("savedTabs");
        if (!currentStored.savedTabs) {
            await browser.storage.local.set({ savedTabs: defaultConfig });
        }

        if (!data.hasShownInstallPage) {
            browser.runtime.openOptionsPage();
            await browser.storage.local.set({ hasShownInstallPage: true });
        }
    }
    restoreTabs();
});

browser.action.onClicked.addListener(() => {
    browser.runtime.openOptionsPage();
});