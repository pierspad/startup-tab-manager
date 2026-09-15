var browser = (typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null));

if (!browser || !browser.storage) {
    // Standalone preview fallback (when opening options.html directly in a browser)
    browser = {
        storage: {
            local: {
                get: async (keys) => {
                    const res = {};
                    const keyList = Array.isArray(keys) ? keys : [keys];
                    for (const k of keyList) {
                        try {
                            const val = localStorage.getItem('stm_preview_' + k);
                            if (val !== null) res[k] = JSON.parse(val);
                        } catch (e) {}
                    }
                    return res;
                },
                set: async (obj) => {
                    for (const [k, v] of Object.entries(obj)) {
                        try {
                            localStorage.setItem('stm_preview_' + k, JSON.stringify(v));
                        } catch (e) {}
                    }
                }
            }
        },
        tabs: {
            query: async () => [
                { url: "https://music.youtube.com/watch?v=cUO6RRd", pinned: true, active: true },
                { url: "https://gemini.google.com/app?hl=it", pinned: false, active: false }
            ]
        },
        windows: {
            getAll: async () => [
                {
                    id: 1,
                    tabs: [
                        { url: "https://music.youtube.com/watch?v=cUO6RRd", pinned: true, active: true },
                        { url: "https://gemini.google.com/app?hl=it", pinned: false, active: false }
                    ]
                }
            ]
        }
    };
}

const windowsContainer = document.getElementById('windows-container');
const addWindowBtn = document.getElementById('add-window-btn');
const importAllBtn = document.getElementById('import-all-btn');
const notification = document.getElementById('notification');
const closeOthersCheckbox = document.getElementById('close-others-checkbox');

let savedWindows = [];

const icons = {
    pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.74V3h-6v7.74a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>`,
    muted: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    up: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`,
    down: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    focus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>`,
    window: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>`,
    globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    import: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`
};

const domParser = new DOMParser();
function getIcon(name) {
    const rawSvg = icons[name] || icons.globe;
    const xml = rawSvg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    return domParser.parseFromString(xml, "image/svg+xml").documentElement;
}

let activeWindowIndex = 0;
let isDeckTransitioning = false;

async function init() {
    const data = await browser.storage.local.get(["savedWindows", "savedTabs", "closeOtherTabs"]);
    const { windows, wasMigrated } = migrateStorageConfig(data);
    savedWindows = windows;

    if (wasMigrated) {
        await browser.storage.local.set({ savedWindows });
    }

    if (closeOthersCheckbox) {
        closeOthersCheckbox.checked = !!data.closeOtherTabs;
        closeOthersCheckbox.addEventListener('change', (e) => {
            browser.storage.local.set({ closeOtherTabs: e.target.checked }).then(() => {
                showNotification("Settings updated!");
            });
        });
    }

    const deckPrevBtn = document.getElementById('deck-prev-btn');
    const deckNextBtn = document.getElementById('deck-next-btn');

    if (deckPrevBtn) {
        deckPrevBtn.addEventListener('click', () => {
            if (activeWindowIndex > 0) {
                goToWindow(activeWindowIndex - 1);
            }
        });
    }

    if (deckNextBtn) {
        deckNextBtn.addEventListener('click', () => {
            if (activeWindowIndex < savedWindows.length - 1) {
                goToWindow(activeWindowIndex + 1);
            }
        });
    }

    addWindowBtn.addEventListener('click', () => {
        const newIndex = savedWindows.length + 1;
        savedWindows.push({
            id: "win-" + Date.now(),
            name: `Window ${newIndex}`,
            tabs: [
                { url: "", pinned: false, muted: false, focus: true }
            ]
        });
        activeWindowIndex = savedWindows.length - 1;
        save(true, `Added Window ${newIndex}`);
        render();
    });

    importAllBtn.addEventListener('click', importAllWindows);

    try {
        const manifest = (typeof browser !== 'undefined' && browser.runtime && browser.runtime.getManifest)
            ? browser.runtime.getManifest()
            : null;
        if (manifest && manifest.version) {
            const versionEl = document.querySelector('.footer-version');
            if (versionEl) {
                versionEl.textContent = `v${manifest.version}`;
            }
        }
    } catch (e) {}

    render();
}

function save(notify = true, message = "Saved!") {
    // Keep savedWindows in sync, and also save first window tabs in savedTabs for retro-compatibility
    const primaryTabs = savedWindows.length > 0 ? savedWindows[0].tabs : [];
    browser.storage.local.set({
        savedWindows,
        savedTabs: primaryTabs
    }).then(() => {
        if (notify) showNotification(message);
    });
}

let notificationTimeout;

function showNotification(msg = "Saved!") {
    clearTimeout(notificationTimeout);
    notification.className = 'notification simple show';
    const msgEl = document.getElementById('snack-message');
    if (msgEl) msgEl.textContent = msg;
    notificationTimeout = setTimeout(() => {
        notification.classList.remove('show');
    }, 2000);
}

function showUndoSnackbar(message, headline = "Item Deleted", onUndo) {
    clearTimeout(notificationTimeout);
    notification.className = 'notification show';

    const headlineEl = document.getElementById('snack-headline');
    if (headlineEl) headlineEl.textContent = headline;

    const messageEl = document.getElementById('snack-message');
    if (messageEl) messageEl.textContent = message;

    const fuseProgress = document.getElementById('fuse-progress');
    if (fuseProgress) {
        fuseProgress.style.animation = 'none';
        void fuseProgress.offsetHeight; // force reflow to restart animation
        fuseProgress.style.animation = 'fuseBurn 4s linear forwards';
    }

    const undoBtn = document.getElementById('snack-undo-btn');
    if (undoBtn) {
        undoBtn.onclick = () => {
            notification.classList.remove('show');
            clearTimeout(notificationTimeout);
            if (onUndo) onUndo();
        };
    }

    notificationTimeout = setTimeout(() => {
        notification.classList.remove('show');
    }, 4000);
}

function updateDeckControls() {
    const prevBtn = document.getElementById('deck-prev-btn');
    const nextBtn = document.getElementById('deck-next-btn');
    const counterEl = document.getElementById('deck-counter');
    const pillsContainer = document.getElementById('deck-pills');

    const total = savedWindows.length;
    if (total === 0) {
        activeWindowIndex = 0;
        if (prevBtn) prevBtn.disabled = true;
        if (nextBtn) nextBtn.disabled = true;
        if (counterEl) counterEl.textContent = 'No Windows';
        if (pillsContainer) pillsContainer.innerHTML = '';
        return;
    }

    if (activeWindowIndex >= total) activeWindowIndex = total - 1;
    if (activeWindowIndex < 0) activeWindowIndex = 0;

    // Non-circular navigation boundaries
    if (prevBtn) {
        prevBtn.disabled = (activeWindowIndex <= 0);
    }
    if (nextBtn) {
        nextBtn.disabled = (activeWindowIndex >= total - 1);
    }

    if (counterEl) {
        const currentWin = savedWindows[activeWindowIndex];
        const winTitle = currentWin && currentWin.name ? currentWin.name : `Window ${activeWindowIndex + 1}`;
        counterEl.textContent = `${winTitle} (${activeWindowIndex + 1} of ${total})`;
    }

    if (pillsContainer) {
        pillsContainer.innerHTML = '';
        for (let i = 0; i < total; i++) {
            const pill = document.createElement('div');
            pill.className = `deck-pill ${i === activeWindowIndex ? 'active' : ''}`;
            pill.title = savedWindows[i]?.name || `Window ${i + 1}`;
            pill.onclick = () => {
                if (i !== activeWindowIndex && !isDeckTransitioning) {
                    goToWindow(i);
                }
            };
            pillsContainer.appendChild(pill);
        }
    }
}

function applyDeckClasses() {
    const cards = windowsContainer.querySelectorAll('.window-card');
    cards.forEach((card, idx) => {
        card.classList.remove(
            'deck-card-active',
            'deck-card-under-1',
            'deck-card-under-2',
            'deck-card-hidden',
            'deck-card-discarded-left',
            'anim-slide-out-left',
            'anim-surface-from-under',
            'anim-slide-in-left',
            'anim-sink-to-under'
        );

        if (idx === activeWindowIndex) {
            card.classList.add('deck-card-active');
        } else if (idx === activeWindowIndex + 1) {
            card.classList.add('deck-card-under-1');
        } else if (idx === activeWindowIndex + 2) {
            card.classList.add('deck-card-under-2');
        } else if (idx > activeWindowIndex + 2) {
            card.classList.add('deck-card-hidden');
        } else if (idx < activeWindowIndex) {
            card.classList.add('deck-card-discarded-left');
        }
    });
}

function goToWindow(targetIndex) {
    if (isDeckTransitioning) return;
    if (targetIndex < 0 || targetIndex >= savedWindows.length) return;
    if (targetIndex === activeWindowIndex) return;

    const direction = targetIndex > activeWindowIndex ? 'next' : 'prev';
    isDeckTransitioning = true;

    const cards = windowsContainer.querySelectorAll('.window-card');
    const currentCard = cards[activeWindowIndex];
    const targetCard = cards[targetIndex];

    if (direction === 'next' && currentCard && targetCard) {
        currentCard.classList.remove('deck-card-active');
        currentCard.classList.add('anim-slide-out-left');

        targetCard.classList.remove('deck-card-under-1', 'deck-card-under-2', 'deck-card-hidden');
        targetCard.classList.add('anim-surface-from-under', 'deck-card-active');

        setTimeout(() => {
            currentCard.classList.remove('anim-slide-out-left');
            targetCard.classList.remove('anim-surface-from-under');
            activeWindowIndex = targetIndex;
            isDeckTransitioning = false;
            applyDeckClasses();
            updateDeckControls();
        }, 380);
    } else if (direction === 'prev' && currentCard && targetCard) {
        targetCard.classList.remove('deck-card-discarded-left', 'deck-card-hidden');
        targetCard.classList.add('anim-slide-in-left', 'deck-card-active');

        currentCard.classList.remove('deck-card-active');
        currentCard.classList.add('anim-sink-to-under');

        setTimeout(() => {
            targetCard.classList.remove('anim-slide-in-left');
            currentCard.classList.remove('anim-sink-to-under');
            activeWindowIndex = targetIndex;
            isDeckTransitioning = false;
            applyDeckClasses();
            updateDeckControls();
        }, 380);
    } else {
        activeWindowIndex = targetIndex;
        isDeckTransitioning = false;
        applyDeckClasses();
        updateDeckControls();
    }
}

function render() {
    windowsContainer.innerHTML = '';

    if (activeWindowIndex >= savedWindows.length) {
        activeWindowIndex = Math.max(0, savedWindows.length - 1);
    }
    if (activeWindowIndex < 0) {
        activeWindowIndex = 0;
    }

    savedWindows.forEach((win, winIndex) => {
        const winCard = renderWindowCard(win, winIndex);
        windowsContainer.appendChild(winCard);
    });

    applyDeckClasses();
    updateDeckControls();
}

function renderWindowCard(win, winIndex) {
    const card = document.createElement('div');
    card.className = 'window-card';
    card.dataset.winIndex = winIndex;

    sortWindowTabs(win);

    const pinnedTabs = win.tabs.filter(t => t.pinned);
    const regularTabs = win.tabs.filter(t => !t.pinned);
    const totalTabs = win.tabs.length;

    // Header
    const header = document.createElement('div');
    header.className = 'window-header';

    const titleArea = document.createElement('div');
    titleArea.className = 'window-title-area';

    const winIcon = document.createElement('span');
    winIcon.className = 'window-icon';
    winIcon.appendChild(getIcon('window'));

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'window-name-input';
    nameInput.value = win.name || `Window ${winIndex + 1}`;
    nameInput.title = "Click to rename window";
    nameInput.onchange = (e) => {
        win.name = e.target.value.trim() || `Window ${winIndex + 1}`;
        save(false);
        updateDeckControls();
    };

    titleArea.append(winIcon, nameInput);

    if (winIndex === 0) {
        const mainBadge = document.createElement('span');
        mainBadge.className = 'window-badge primary-badge';
        mainBadge.textContent = 'Main Window';
        titleArea.appendChild(mainBadge);
    }

    const countBadge = document.createElement('span');
    countBadge.className = 'window-badge';
    countBadge.textContent = `${totalTabs} tab${totalTabs === 1 ? '' : 's'}`;
    titleArea.appendChild(countBadge);

    const actionsArea = document.createElement('div');
    actionsArea.className = 'window-actions';

    const importWinBtn = document.createElement('button');
    importWinBtn.className = 'window-btn';
    importWinBtn.appendChild(getIcon('import'));
    const importText = document.createElement('span');
    importText.textContent = 'Import Tabs';
    importWinBtn.appendChild(importText);
    importWinBtn.title = "Import all open tabs from your active window into this list";
    importWinBtn.onclick = () => importTabsToWindow(winIndex);

    actionsArea.appendChild(importWinBtn);

    if (savedWindows.length > 1) {
        const deleteWinBtn = document.createElement('button');
        deleteWinBtn.className = 'window-btn delete-win';
        deleteWinBtn.appendChild(getIcon('trash'));
        const deleteText = document.createElement('span');
        deleteText.textContent = 'Delete window';
        deleteWinBtn.appendChild(deleteText);
        deleteWinBtn.title = "Delete this window configuration";
        deleteWinBtn.onclick = () => {
            const removedWindow = JSON.parse(JSON.stringify(savedWindows[winIndex]));
            const removedIndex = winIndex;
            savedWindows.splice(winIndex, 1);
            if (activeWindowIndex >= savedWindows.length) {
                activeWindowIndex = Math.max(0, savedWindows.length - 1);
            }
            save(false);
            render();
            showUndoSnackbar(
                `Removed "${removedWindow.name}" (${removedWindow.tabs.length} tabs)`,
                "Window Deleted",
                () => {
                    savedWindows.splice(removedIndex, 0, removedWindow);
                    activeWindowIndex = removedIndex;
                    save(false);
                    render();
                    showNotification("Window Restored!");
                }
            );
        };
        actionsArea.appendChild(deleteWinBtn);
    }

    header.append(titleArea, actionsArea);
    card.appendChild(header);

    // --- Pinned Tabs Section ---
    const pinnedSection = document.createElement('div');
    pinnedSection.className = 'tab-section';

    const pinnedHeader = document.createElement('div');
    pinnedHeader.className = 'section-header';

    const pinnedTitle = document.createElement('div');
    pinnedTitle.className = 'section-title pinned';
    pinnedTitle.appendChild(getIcon('pin'));
    const pinnedTitleText = document.createElement('span');
    pinnedTitleText.textContent = 'Pinned Tabs';
    pinnedTitle.appendChild(pinnedTitleText);

    const pinnedBadge = document.createElement('span');
    pinnedBadge.className = 'section-badge';
    pinnedBadge.textContent = pinnedTabs.length;

    pinnedHeader.append(pinnedTitle, pinnedBadge);
    pinnedSection.appendChild(pinnedHeader);

    const pinnedList = document.createElement('div');
    pinnedList.className = 'tab-list';

    if (pinnedTabs.length === 0) {
        const emptyPinned = document.createElement('div');
        emptyPinned.className = 'empty-section-placeholder';
        emptyPinned.textContent = "No pinned tabs. Click the 📌 icon on any tab below to pin it.";
        pinnedList.appendChild(emptyPinned);
    } else {
        pinnedTabs.forEach((tab, pIndex) => {
            const globalIndex = pIndex; // Pinned tabs are always indices 0 .. pinnedTabs.length - 1
            const cardEl = renderTabCard(tab, globalIndex, winIndex, pIndex, pinnedTabs, true);
            pinnedList.appendChild(cardEl);
        });
    }

    pinnedSection.appendChild(pinnedList);
    card.appendChild(pinnedSection);

    // Divider
    const divider = document.createElement('hr');
    divider.className = 'section-divider';
    card.appendChild(divider);

    // --- Regular Tabs Section ---
    const regularSection = document.createElement('div');
    regularSection.className = 'tab-section';

    const regularHeader = document.createElement('div');
    regularHeader.className = 'section-header';

    const regularTitle = document.createElement('div');
    regularTitle.className = 'section-title';
    regularTitle.appendChild(getIcon('globe'));
    const regularTitleText = document.createElement('span');
    regularTitleText.textContent = 'Regular Tabs';
    regularTitle.appendChild(regularTitleText);

    const regularBadge = document.createElement('span');
    regularBadge.className = 'section-badge';
    regularBadge.textContent = regularTabs.length;

    regularHeader.append(regularTitle, regularBadge);
    regularSection.appendChild(regularHeader);

    const regularList = document.createElement('div');
    regularList.className = 'tab-list';

    if (regularTabs.length === 0) {
        const emptyRegular = document.createElement('div');
        emptyRegular.className = 'empty-section-placeholder';
        emptyRegular.textContent = "No regular tabs. Click \"Add Tab\" below to create one.";
        regularList.appendChild(emptyRegular);
    } else {
        regularTabs.forEach((tab, rIndex) => {
            const globalIndex = pinnedTabs.length + rIndex; // Continuing tab numbers seamlessly
            const cardEl = renderTabCard(tab, globalIndex, winIndex, rIndex, regularTabs, false);
            regularList.appendChild(cardEl);
        });
    }

    regularSection.appendChild(regularList);
    card.appendChild(regularSection);

    // Window Footer: Add Tab
    const footer = document.createElement('div');
    footer.className = 'window-footer';

    const addTabBtn = document.createElement('button');
    addTabBtn.className = 'add-tab-btn';
    addTabBtn.appendChild(getIcon('plus'));
    const addTabText = document.createElement('span');
    addTabText.textContent = `Add Tab to ${win.name || `Window ${winIndex + 1}`}`;
    addTabBtn.appendChild(addTabText);
    addTabBtn.onclick = () => {
        win.tabs.push({
            url: "",
            pinned: false,
            muted: false,
            focus: win.tabs.length === 0
        });
        sortWindowTabs(win);
        save(false);
        render();
    };

    footer.appendChild(addTabBtn);
    card.appendChild(footer);

    return card;
}

function renderTabCard(tab, globalIndex, winIndex, groupIndex, groupArray, isPinned) {
    const card = document.createElement('div');
    card.className = `tab-card ${isPinned ? 'pinned' : ''}`;

    // 1-based sequential position number reflecting exact Firefox tab bar index
    const numSpan = document.createElement('span');
    numSpan.className = 'tab-number';
    numSpan.textContent = `${globalIndex + 1}.`;
    numSpan.title = `Firefox Tab Position #${globalIndex + 1}`;
    card.appendChild(numSpan);

    // Reorder controls: Up / Down
    const moveControls = document.createElement('div');
    moveControls.className = 'controls move-controls';

    const upBtn = document.createElement('button');
    upBtn.className = 'icon-btn move-btn';
    upBtn.appendChild(getIcon('up'));
    upBtn.title = "Move tab up";

    const downBtn = document.createElement('button');
    downBtn.className = 'icon-btn move-btn';
    downBtn.appendChild(getIcon('down'));
    downBtn.title = "Move tab down";

    // Boundary check: Hide up arrow for first in group, hide down arrow for last in group
    const canMoveUp = canMoveTabUp(isPinned, groupIndex);
    const canMoveDown = canMoveTabDown(isPinned, groupIndex, groupArray.length);

    if (!canMoveUp) {
        upBtn.classList.add('arrow-hidden');
        upBtn.disabled = true;
    } else {
        upBtn.onclick = () => moveTabInGroup(winIndex, isPinned, groupIndex, -1);
    }

    if (!canMoveDown) {
        downBtn.classList.add('arrow-hidden');
        downBtn.disabled = true;
    } else {
        downBtn.onclick = () => moveTabInGroup(winIndex, isPinned, groupIndex, 1);
    }

    moveControls.append(upBtn, downBtn);
    card.appendChild(moveControls);

    // URL input
    const inputContainer = document.createElement('div');
    inputContainer.className = 'url-input-container';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'url-input';
    input.value = tab.url;
    input.placeholder = "https://example.com";
    input.title = "Tab URL";

    const updateWarning = (val) => {
        const existingWarning = inputContainer.querySelector('.url-file-warning');
        if (val.trim().toLowerCase().startsWith('file://')) {
            if (!existingWarning) {
                const warn = document.createElement('div');
                warn.className = 'url-file-warning';
                warn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg><span>Firefox policy forbids extensions from opening local file:// URLs.</span>`;
                inputContainer.appendChild(warn);
            }
        } else if (existingWarning) {
            existingWarning.remove();
        }
    };

    input.oninput = (e) => updateWarning(e.target.value);
    input.onchange = (e) => {
        tab.url = e.target.value.trim();
        updateWarning(tab.url);
        save(false);
    };

    updateWarning(tab.url);
    inputContainer.appendChild(input);
    card.appendChild(inputContainer);

    // Right Action Controls: Pin, Mute, Focus, Delete
    const rightControls = document.createElement('div');
    rightControls.className = 'controls';

    // Pin Toggle
    const pinBtn = document.createElement('button');
    pinBtn.className = `icon-btn ${tab.pinned ? 'active' : ''}`;
    pinBtn.appendChild(getIcon('pin'));
    pinBtn.title = tab.pinned ? "Unpin tab" : "Pin tab";
    pinBtn.onclick = () => {
        tab.pinned = !tab.pinned;
        sortWindowTabs(savedWindows[winIndex]);
        save(true, tab.pinned ? "Tab pinned!" : "Tab unpinned!");
        render();
    };

    // Mute Toggle
    const muteBtn = document.createElement('button');
    muteBtn.className = `icon-btn ${tab.muted ? 'active' : ''}`;
    muteBtn.appendChild(getIcon('muted'));
    muteBtn.title = tab.muted ? "Unmute on startup" : "Mute on startup";
    muteBtn.onclick = () => {
        tab.muted = !tab.muted;
        save(false);
        render();
    };

    // Focus Toggle (radio behavior within this window)
    const focusBtn = document.createElement('button');
    focusBtn.className = `icon-btn ${tab.focus ? 'active' : ''}`;
    focusBtn.appendChild(getIcon('focus'));
    focusBtn.title = tab.focus ? "Active focused tab" : "Set as focused tab on startup";
    focusBtn.onclick = () => {
        const win = savedWindows[winIndex];
        win.tabs.forEach(t => t.focus = (t === tab));
        save(false);
        render();
    };

    // Delete Tab
    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn delete';
    delBtn.appendChild(getIcon('trash'));
    delBtn.title = "Remove tab";
    delBtn.onclick = () => {
        const win = savedWindows[winIndex];
        const tabIndexInWin = win.tabs.indexOf(tab);
        if (tabIndexInWin !== -1) {
            const [deletedTab] = win.tabs.splice(tabIndexInWin, 1);
            const wasFocused = deletedTab.focus;
            if (wasFocused && win.tabs.length > 0) {
                win.tabs[0].focus = true;
            }
            save(false);
            render();

            const displayName = deletedTab.url
                ? deletedTab.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
                : 'Empty tab';

            showUndoSnackbar(
                `Removed tab "${displayName}" from ${win.name || `Window ${winIndex + 1}`}`,
                "Tab Deleted",
                () => {
                    win.tabs.splice(tabIndexInWin, 0, deletedTab);
                    if (wasFocused) {
                        win.tabs.forEach(t => t.focus = (t === deletedTab));
                    }
                    sortWindowTabs(win);
                    save(false);
                    render();
                    showNotification("Tab Restored!");
                }
            );
        }
    };

    rightControls.append(pinBtn, muteBtn, focusBtn, delBtn);
    card.appendChild(rightControls);

    return card;
}

function moveTabInGroup(winIndex, isPinned, groupIndex, direction) {
    const win = savedWindows[winIndex];
    if (moveTabInWindow(win, isPinned, groupIndex, direction)) {
        save(false);
        render();
    }
}

async function importTabsToWindow(winIndex) {
    try {
        const tabs = await browser.tabs.query({ currentWindow: true });
        const newTabs = tabs
            .filter(t => t.url && t.url !== window.location.href && !t.url.startsWith("about:devtools"))
            .map(t => ({
                url: t.url,
                pinned: !!t.pinned,
                muted: t.mutedInfo ? !!t.mutedInfo.muted : false,
                focus: !!t.active
            }));

        if (newTabs.length === 0) {
            showNotification("No tabs found to import");
            return;
        }

        const win = savedWindows[winIndex];
        // If window only has empty placeholder tabs, replace them
        const hasOnlyEmptyTabs = win.tabs.length === 1 && win.tabs[0].url.trim() === "";
        if (hasOnlyEmptyTabs) {
            win.tabs = newTabs;
        } else {
            win.tabs = [...win.tabs, ...newTabs];
        }

        if (!win.tabs.some(t => t.focus) && win.tabs.length > 0) {
            win.tabs[0].focus = true;
        }

        sortWindowTabs(win);
        save(true, `Imported ${newTabs.length} tabs into ${win.name}!`);
        render();
    } catch (e) {
        console.error("Error importing tabs:", e);
        showNotification("Failed to import tabs");
    }
}

async function importAllWindows() {
    try {
        const allBrowserWindows = await browser.windows.getAll({ populate: true });
        const newWindows = [];
        let winIndex = 1;

        for (const bWin of allBrowserWindows) {
            const tabs = (bWin.tabs || [])
                .filter(t => t.url && t.url !== window.location.href && !t.url.startsWith("about:devtools"))
                .map(t => ({
                    url: t.url,
                    pinned: !!t.pinned,
                    muted: t.mutedInfo ? !!t.mutedInfo.muted : false,
                    focus: !!t.active
                }));

            if (tabs.length > 0) {
                if (!tabs.some(t => t.focus)) tabs[0].focus = true;
                tabs.sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));

                newWindows.push({
                    id: "win-" + (bWin.id || Date.now() + Math.random()),
                    name: winIndex === 1 ? "Window 1" : `Window ${winIndex}`,
                    tabs
                });
                winIndex++;
            }
        }

        if (newWindows.length === 0) {
            showNotification("No open tabs found to import");
            return;
        }

        savedWindows = newWindows;
        save(true, `Imported ${newWindows.length} windows!`);
        render();
    } catch (e) {
        console.error("Error importing windows:", e);
        showNotification("Failed to import windows");
    }
}

init();