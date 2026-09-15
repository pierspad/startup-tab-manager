const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
    sortWindowTabs,
    canMoveTabUp,
    canMoveTabDown,
    moveTabInWindow
} = require('../utils.js');

describe('Tab Sorting & Boundary Rules', () => {
    test('sortWindowTabs ensures pinned tabs always precede regular tabs', () => {
        const win = {
            tabs: [
                { url: 'https://regular1.com', pinned: false },
                { url: 'https://pinned1.com', pinned: true },
                { url: 'https://regular2.com', pinned: false },
                { url: 'https://pinned2.com', pinned: true }
            ]
        };

        sortWindowTabs(win);

        assert.strictEqual(win.tabs[0].url, 'https://pinned1.com');
        assert.strictEqual(win.tabs[0].pinned, true);
        assert.strictEqual(win.tabs[1].url, 'https://pinned2.com');
        assert.strictEqual(win.tabs[1].pinned, true);
        assert.strictEqual(win.tabs[2].url, 'https://regular1.com');
        assert.strictEqual(win.tabs[2].pinned, false);
        assert.strictEqual(win.tabs[3].url, 'https://regular2.com');
        assert.strictEqual(win.tabs[3].pinned, false);
    });

    test('canMoveTabUp and canMoveTabDown enforce solid wall boundaries', () => {
        // In a group of 3 items (indices 0, 1, 2)
        const groupLength = 3;

        // First item
        assert.strictEqual(canMoveTabUp(true, 0), false, 'First pinned item cannot move up');
        assert.strictEqual(canMoveTabDown(true, 0, groupLength), true, 'First pinned item can move down');

        // Middle item
        assert.strictEqual(canMoveTabUp(true, 1), true, 'Middle pinned item can move up');
        assert.strictEqual(canMoveTabDown(true, 1, groupLength), true, 'Middle pinned item can move down');

        // Last item
        assert.strictEqual(canMoveTabUp(true, 2), true, 'Last pinned item can move up');
        assert.strictEqual(canMoveTabDown(true, 2, groupLength), false, 'Last pinned item cannot move down (blocked by wall)');

        // Same boundary applies to regular group
        assert.strictEqual(canMoveTabUp(false, 0), false, 'First regular item cannot move up (blocked by wall)');
        assert.strictEqual(canMoveTabDown(false, 0, groupLength), true, 'First regular item can move down');
        assert.strictEqual(canMoveTabDown(false, 2, groupLength), false, 'Last regular item cannot move down');
    });

    test('moveTabInWindow reorders within group and never crosses boundary', () => {
        const win = {
            tabs: [
                { url: 'p1', pinned: true },
                { url: 'p2', pinned: true },
                { url: 'r1', pinned: false },
                { url: 'r2', pinned: false }
            ]
        };

        // Move p1 down
        const movedP1 = moveTabInWindow(win, true, 0, 1);
        assert.strictEqual(movedP1, true);
        assert.strictEqual(win.tabs[0].url, 'p2');
        assert.strictEqual(win.tabs[1].url, 'p1');
        assert.strictEqual(win.tabs[2].url, 'r1', 'Regular tab r1 must not move');

        // Try to move p1 (now at index 1 of pinned, groupLength=2) down across boundary
        const tryCrossDown = moveTabInWindow(win, true, 1, 1);
        assert.strictEqual(tryCrossDown, false, 'Moving pinned down across wall must return false');
        assert.strictEqual(win.tabs[1].url, 'p1');
        assert.strictEqual(win.tabs[2].url, 'r1');

        // Try to move r1 (index 0 of regular) up across boundary into pinned
        const tryCrossUp = moveTabInWindow(win, false, 0, -1);
        assert.strictEqual(tryCrossUp, false, 'Moving regular up across wall must return false');
        assert.strictEqual(win.tabs[2].url, 'r1');
        assert.strictEqual(win.tabs[1].url, 'p1');

        // Move r1 down within regular
        const movedR1 = moveTabInWindow(win, false, 0, 1);
        assert.strictEqual(movedR1, true);
        assert.strictEqual(win.tabs[2].url, 'r2');
        assert.strictEqual(win.tabs[3].url, 'r1');
    });
});
