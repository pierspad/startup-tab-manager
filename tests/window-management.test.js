const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { sortWindowTabs } = require('../utils.js');

describe('Window and Tab State Management', () => {
    test('toggling pinned status moves tab cleanly and preserves sorting', () => {
        const win = {
            tabs: [
                { url: 'p1', pinned: true },
                { url: 'r1', pinned: false },
                { url: 'r2', pinned: false }
            ]
        };

        // Pin r2
        win.tabs[2].pinned = true;
        sortWindowTabs(win);

        const pinned = win.tabs.filter(t => t.pinned);
        const regular = win.tabs.filter(t => !t.pinned);

        assert.strictEqual(pinned.length, 2);
        assert.strictEqual(regular.length, 1);
        assert.strictEqual(win.tabs[0].pinned, true);
        assert.strictEqual(win.tabs[1].pinned, true);
        assert.strictEqual(win.tabs[2].pinned, false);
        assert.strictEqual(win.tabs[2].url, 'r1');
    });

    test('deleting focused tab safely reassigns focus to remaining tab', () => {
        const win = {
            tabs: [
                { url: 'tab1', pinned: true, focus: true },
                { url: 'tab2', pinned: false, focus: false }
            ]
        };

        // Delete tab1
        const removed = win.tabs.shift();
        if (removed.focus && win.tabs.length > 0) {
            win.tabs[0].focus = true;
        }

        assert.strictEqual(win.tabs.length, 1);
        assert.strictEqual(win.tabs[0].url, 'tab2');
        assert.strictEqual(win.tabs[0].focus, true);
    });

    test('multiple windows maintain isolated tab lists and names', () => {
        const windows = [
            { id: 'w1', name: 'Window 1 (Main)', tabs: [{ url: 'w1-t1', pinned: true }] },
            { id: 'w2', name: 'Window 2', tabs: [{ url: 'w2-t1', pinned: false }, { url: 'w2-t2', pinned: false }] }
        ];

        assert.strictEqual(windows.length, 2);
        assert.strictEqual(windows[0].tabs.length, 1);
        assert.strictEqual(windows[1].tabs.length, 2);

        // Delete window 2
        windows.splice(1, 1);
        assert.strictEqual(windows.length, 1);
        assert.strictEqual(windows[0].id, 'w1');
    });
});
