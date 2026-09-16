/**
 * Core utility functions and defaults for Startup Tab Manager.
 * Compatible with both WebExtension environments and Node.js test runners.
 */

const defaultConfig = [
    { url: "https://www.wikipedia.org/", pinned: true, muted: false, focus: false },
    { url: "https://www.wikipedia.org/", pinned: false, muted: false, focus: true }
];

const defaultWindows = [
    {
        id: "win-1",
        name: "Window",
        tabs: defaultConfig,
        incognito: false
    }
];

/**
 * Normalizes URLs for accurate comparison and duplicate avoidance.
 */
function normalizeUrl(url) {
    if (!url || url === "about:newtab" || url === "chrome://newtab/") {
        return "kJ_NEW_TAB_kJ";
    }
    try {
        const u = new URL(url);
        let host = u.hostname.replace(/^www\./, "");
        let path = u.pathname.replace(/\/$/, "");
        return host + path + u.search + u.hash;
    } catch (e) {
        return url.replace(/\/$/, "");
    }
}

/**
 * Ensures tabs inside a window are strictly sorted pinned-first.
 */
function sortWindowTabs(win) {
    if (!win || !win.tabs) return;
    win.tabs.sort((a, b) => {
        if (a.pinned === b.pinned) return 0;
        return a.pinned ? -1 : 1;
    });
}

/**
 * Determines whether a tab can move up within its group (pinned or regular).
 */
function canMoveTabUp(isPinned, groupIndex) {
    return groupIndex > 0;
}

/**
 * Determines whether a tab can move down within its group (pinned or regular).
 */
function canMoveTabDown(isPinned, groupIndex, groupLength) {
    return groupIndex < groupLength - 1;
}

/**
 * Moves a tab up (-1) or down (+1) strictly within its group boundary.
 * Never allows crossing between pinned and regular groups.
 */
function moveTabInWindow(win, isPinned, groupIndex, direction) {
    if (!win || !win.tabs) return false;

    const pinnedCount = win.tabs.filter(t => t.pinned).length;
    const groupLength = isPinned ? pinnedCount : (win.tabs.length - pinnedCount);

    if (direction === -1 && !canMoveTabUp(isPinned, groupIndex)) return false;
    if (direction === 1 && !canMoveTabDown(isPinned, groupIndex, groupLength)) return false;

    const baseOffset = isPinned ? 0 : pinnedCount;
    const currentIdx = baseOffset + groupIndex;
    const targetIdx = currentIdx + direction;

    if (targetIdx < 0 || targetIdx >= win.tabs.length) return false;

    const temp = win.tabs[currentIdx];
    win.tabs[currentIdx] = win.tabs[targetIdx];
    win.tabs[targetIdx] = temp;

    return true;
}

/**
 * Migrates storage data from legacy `savedTabs` format to `savedWindows`.
 */
function migrateStorageConfig(data) {
    if (!data) {
        return {
            windows: JSON.parse(JSON.stringify(defaultWindows)),
            closeOtherTabs: false,
            wasMigrated: true
        };
    }

    let windows = data.savedWindows;
    let wasMigrated = false;

    if (!windows || !Array.isArray(windows) || windows.length === 0) {
        if (data.savedTabs && Array.isArray(data.savedTabs) && data.savedTabs.length > 0) {
            windows = [
                {
                    id: "win-1",
                    name: "Window",
                    tabs: JSON.parse(JSON.stringify(data.savedTabs))
                }
            ];
            wasMigrated = true;
        } else {
            windows = JSON.parse(JSON.stringify(defaultWindows));
            wasMigrated = true;
        }
    }

    // Ensure focus, incognito, and sorting integrity
    windows.forEach(win => {
        win.incognito = !!win.incognito;
        sortWindowTabs(win);
        if (win.tabs && win.tabs.length > 0 && !win.tabs.some(t => t.focus)) {
            win.tabs[0].focus = true;
        }
    });

    return {
        windows,
        closeOtherTabs: !!data.closeOtherTabs,
        wasMigrated
    };
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        defaultConfig,
        defaultWindows,
        normalizeUrl,
        sortWindowTabs,
        canMoveTabUp,
        canMoveTabDown,
        moveTabInWindow,
        migrateStorageConfig
    };
}
