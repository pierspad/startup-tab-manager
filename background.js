var browser = (typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null));

async function getSavedConfig() {
    const data = await browser.storage.local.get(["savedWindows", "savedTabs", "closeOtherTabs"]);
    const { windows, closeOtherTabs, wasMigrated } = migrateStorageConfig(data);
    if (wasMigrated) {
        await browser.storage.local.set({ savedWindows: windows });
    }
    return { windows, closeOtherTabs };
}

async function restoreTabsInWindow(windowId, configTabs, shouldCloseOthers = false) {
    if (!configTabs || configTabs.length === 0) return [];

    const currentTabs = await browser.tabs.query({ windowId });
    const reusedTabIds = new Set();
    const finalTabIds = [];

    for (let i = 0; i < configTabs.length; i++) {
        const target = configTabs[i];
        const targetNorm = normalizeUrl(target.url);
        const urlToOpen = target.url || undefined;

        const existingTab = currentTabs.find(t => {
            if (reusedTabIds.has(t.id)) return false;
            return normalizeUrl(t.url) === targetNorm;
        });

        if (existingTab) {
            reusedTabIds.add(existingTab.id);
            finalTabIds.push(existingTab.id);

            await browser.tabs.move(existingTab.id, { index: i });
            await browser.tabs.update(existingTab.id, {
                pinned: !!target.pinned,
                muted: !!target.muted
            });

            if (target.focus) {
                await browser.tabs.update(existingTab.id, { active: true });
            }
        } else {
            const isActive = !!target.focus;
            const newTab = await browser.tabs.create({
                url: urlToOpen,
                index: i,
                pinned: !!target.pinned,
                active: isActive,
                windowId: windowId
            });
            finalTabIds.push(newTab.id);

            if (target.muted) {
                await browser.tabs.update(newTab.id, { muted: true });
            }
        }
    }

    if (shouldCloseOthers) {
        const allTabsNow = await browser.tabs.query({ windowId });
        const tabsToRemove = allTabsNow
            .filter(t => !finalTabIds.includes(t.id))
            .filter(t => !t.url.startsWith(browser.runtime.getURL("")))
            .map(t => t.id);

        if (tabsToRemove.length > 0) {
            await browser.tabs.remove(tabsToRemove);
        }
    }

    return finalTabIds;
}

async function createAndRestoreWindow(windowConfig) {
    if (!windowConfig.tabs || windowConfig.tabs.length === 0) return null;

    const tabs = [...windowConfig.tabs].sort((a, b) => {
        if (a.pinned === b.pinned) return 0;
        return a.pinned ? -1 : 1;
    });

    const firstTab = tabs[0];
    const newWindow = await browser.windows.create({
        url: firstTab.url || undefined
    });

    // Handle initial tab properties
    const winTabs = await browser.tabs.query({ windowId: newWindow.id });
    if (winTabs.length > 0) {
        const initialTab = winTabs[0];
        await browser.tabs.update(initialTab.id, {
            pinned: !!firstTab.pinned,
            muted: !!firstTab.muted,
            active: !!firstTab.focus
        });
    }

    // Create remaining tabs
    for (let i = 1; i < tabs.length; i++) {
        const target = tabs[i];
        const newTab = await browser.tabs.create({
            windowId: newWindow.id,
            url: target.url || undefined,
            index: i,
            pinned: !!target.pinned,
            active: !!target.focus
        });

        if (target.muted) {
            await browser.tabs.update(newTab.id, { muted: true });
        }
    }

    return newWindow;
}

let isRestoring = false;

async function restoreAllTabs() {
    if (isRestoring) return;
    isRestoring = true;

    try {
        const { windows, closeOtherTabs } = await getSavedConfig();
        if (!windows || windows.length === 0) return;

        const openWindows = await browser.windows.getAll();

        for (let i = 0; i < windows.length; i++) {
            const winConfig = windows[i];
            if (!winConfig.tabs || winConfig.tabs.length === 0) continue;

            const sortedTabs = [...winConfig.tabs].sort((a, b) => {
                if (a.pinned === b.pinned) return 0;
                return a.pinned ? -1 : 1;
            });

            if (i < openWindows.length) {
                // Restore into existing window
                await restoreTabsInWindow(openWindows[i].id, sortedTabs, i === 0 ? closeOtherTabs : false);
            } else {
                // Create new window for additional configured windows
                await createAndRestoreWindow({ ...winConfig, tabs: sortedTabs });
            }
        }
    } catch (e) {
        console.error("Startup Tab Manager: Error restoring tabs:", e);
    } finally {
        setTimeout(() => {
            isRestoring = false;
        }, 1000);
    }
}

browser.runtime.onStartup.addListener(() => {
    setTimeout(restoreAllTabs, 800);
});

browser.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === "install") {
        const data = await browser.storage.local.get(["hasShownInstallPage", "savedWindows", "savedTabs"]);
        if (!data.savedWindows && !data.savedTabs) {
            await browser.storage.local.set({
                savedWindows: defaultWindows,
                savedTabs: defaultConfig
            });
        }

        if (!data.hasShownInstallPage) {
            browser.runtime.openOptionsPage();
            await browser.storage.local.set({ hasShownInstallPage: true });
        }
    }
    restoreAllTabs();
});

browser.action.onClicked.addListener(() => {
    browser.runtime.openOptionsPage();
});