var browser = browser || chrome;
const listContainer = document.getElementById('tabs-list');
const addBtn = document.getElementById('add-tab-btn');
const importBtn = document.getElementById('import-btn');
const notification = document.getElementById('notification');

let savedTabs = [];

const icons = {
    pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.74V3h-6v7.74a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>`,
    muted: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`,
    trash: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    up: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>`,
    down: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    focus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>`
};

const parser = new DOMParser();
function getIcon(name) {
    const svgContent = icons[name].replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    return parser.parseFromString(svgContent, "image/svg+xml").documentElement;
}

const defaultConfig = [
    { url: "https://archlinux.org", pinned: true, muted: false, focus: true },
    { url: "https://news.ycombinator.com", pinned: false, muted: false, focus: false }
];

function sortTabs() {
    savedTabs.sort((a, b) => {
        if (a.pinned === b.pinned) return 0;
        return a.pinned ? -1 : 1;
    });
}

async function init() {
    const data = await browser.storage.local.get(["savedTabs", "closeOtherTabs"]);
    if (!data.savedTabs) {
        savedTabs = defaultConfig;
        await browser.storage.local.set({ savedTabs });
    } else {
        savedTabs = data.savedTabs;
        // Ensure at least one tab is focused if none are (migration)
        if (!savedTabs.some(t => t.focus)) {
            if (savedTabs.length > 0) savedTabs[0].focus = true;
        }
    }

    const closeOthersCheckbox = document.getElementById('close-others-checkbox');
    if (closeOthersCheckbox) {
        closeOthersCheckbox.checked = data.closeOtherTabs || false;
        closeOthersCheckbox.addEventListener('change', (e) => {
            browser.storage.local.set({ closeOtherTabs: e.target.checked }).then(showNotification);
        });
    }

    sortTabs();
    render();
}

function save(notify = true) {
    browser.storage.local.set({ savedTabs }).then(() => {
        if (notify) showNotification();
    });
}

function showNotification(msg = "Saved!") {
    notification.textContent = msg;
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 2000);
}

function createTabElement(tab, index) {
    const card = document.createElement('div');
    card.className = 'tab-card';

    const numSpan = document.createElement('span');
    numSpan.className = 'tab-number';
    numSpan.textContent = (index + 1) + ".";
    card.appendChild(numSpan);

    const moveControls = document.createElement('div');
    moveControls.className = 'controls';

    const upBtn = document.createElement('button');
    upBtn.className = 'icon-btn';
    upBtn.appendChild(getIcon('up'));
    upBtn.onclick = () => moveTab(index, -1);

    const downBtn = document.createElement('button');
    downBtn.className = 'icon-btn';
    downBtn.appendChild(getIcon('down'));
    downBtn.onclick = () => moveTab(index, 1);

    if (index === 0) upBtn.style.visibility = 'hidden';
    if (index === savedTabs.length - 1) downBtn.style.visibility = 'hidden';

    moveControls.appendChild(upBtn);
    moveControls.appendChild(downBtn);

    const inputContainer = document.createElement('div');
    inputContainer.className = 'url-input-container';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'url-input';
    input.value = tab.url;
    input.placeholder = "https://example.com";
    input.onchange = (e) => {
        savedTabs[index].url = e.target.value.trim();
        save();
    };

    inputContainer.appendChild(input);

    const rightControls = document.createElement('div');
    rightControls.className = 'controls';

    const pinBtn = document.createElement('button');
    pinBtn.className = `icon-btn ${tab.pinned ? 'active' : ''}`;
    pinBtn.appendChild(getIcon('pin'));
    pinBtn.title = "Toggle Pin";
    pinBtn.onclick = () => {
        savedTabs[index].pinned = !savedTabs[index].pinned;
        sortTabs();
        save();
        render();
    };

    const muteBtn = document.createElement('button');
    muteBtn.className = `icon-btn ${tab.muted ? 'active' : ''}`;
    muteBtn.appendChild(getIcon('muted'));
    muteBtn.title = "Toggle Mute";
    muteBtn.onclick = () => {
        savedTabs[index].muted = !savedTabs[index].muted;
        save();
        render();
    };

    const focusBtn = document.createElement('button');
    focusBtn.className = `icon-btn ${tab.focus ? 'active' : ''}`;
    focusBtn.appendChild(getIcon('focus'));
    focusBtn.title = "Set Focus on Startup";
    focusBtn.onclick = () => {
        savedTabs.forEach((t, i) => t.focus = (i === index));
        save();
        render();
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'icon-btn delete';
    delBtn.appendChild(getIcon('trash'));
    delBtn.title = "Remove Tab";
    delBtn.onclick = () => {
        savedTabs.splice(index, 1);
        // If we deleted the focused tab, focus the first one (or none, but let's try to keep one)
        if (tab.focus && savedTabs.length > 0) {
            savedTabs[0].focus = true;
        }
        save();
        render();
    };

    rightControls.append(pinBtn, muteBtn, focusBtn, delBtn);

    card.append(moveControls, inputContainer, rightControls);
    return card;
}

function render() {
    listContainer.innerHTML = '';
    savedTabs.forEach((tab, index) => {
        if (index > 0 && savedTabs[index - 1].pinned && !tab.pinned) {
            const sep = document.createElement('div');
            sep.className = 'list-separator';
            listContainer.appendChild(sep);
        }
        listContainer.appendChild(createTabElement(tab, index));
    });
}


function moveTab(index, direction) {
    if ((direction === -1 && index === 0) || (direction === 1 && index === savedTabs.length - 1)) {
        return;
    }

    // Prevent crossing pinned/unpinned boundary
    if (savedTabs[index].pinned !== savedTabs[index + direction].pinned) {
        return;
    }

    const cards = document.querySelectorAll('.tab-card');
    const currentCard = cards[index];
    const targetCard = cards[index + direction];

    const distance = targetCard.offsetTop - currentCard.offsetTop;

    currentCard.style.transition = 'transform 0.2s ease';
    targetCard.style.transition = 'transform 0.2s ease';

    currentCard.style.transform = `translateY(${distance}px)`;
    targetCard.style.transform = `translateY(${-distance}px)`;

    setTimeout(() => {
        if (direction === -1) {
            [savedTabs[index], savedTabs[index - 1]] = [savedTabs[index - 1], savedTabs[index]];
        } else {
            [savedTabs[index], savedTabs[index + 1]] = [savedTabs[index + 1], savedTabs[index]];
        }

        save();
        render();
    }, 200);
}

addBtn.addEventListener('click', () => {
    savedTabs.push({ url: "", pinned: false, muted: false, focus: savedTabs.length === 0 });
    sortTabs();
    save();
    render();
});

importBtn.addEventListener('click', async () => {
    const tabs = await browser.tabs.query({ currentWindow: true });

    // Filter out the options page itself to avoid recursion/clutter
    const newTabs = tabs
        .filter(t => t.url !== window.location.href)
        .map(t => ({
            url: t.url,
            pinned: t.pinned,
            muted: t.mutedInfo ? t.mutedInfo.muted : false,
            focus: false
        }));

    if (newTabs.length === 0) {
        showNotification("No tabs to import");
        return;
    }

    savedTabs = [...savedTabs, ...newTabs];

    // Ensure one tab is focused if we had none (e.g. empty list before)
    if (!savedTabs.some(t => t.focus) && savedTabs.length > 0) {
        savedTabs[0].focus = true;
    }

    sortTabs();
    save(false);
    render();
    showNotification("Imported " + newTabs.length + " tabs!");
});


init();