const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { migrateStorageConfig, defaultConfig, defaultWindows } = require('../utils.js');

describe('Storage Migration & Schema Compatibility', () => {
    test('returns defaultWindows when storage data is null or empty', () => {
        const result = migrateStorageConfig(null);
        assert.strictEqual(result.wasMigrated, true);
        assert.strictEqual(result.windows.length, 1);
        assert.strictEqual(result.windows[0].name, 'Window 1');
        assert.strictEqual(result.windows[0].tabs.length, defaultConfig.length);
        assert.strictEqual(result.closeOtherTabs, false);
    });

    test('migrates legacy savedTabs into Window 1 without data loss', () => {
        const legacyData = {
            savedTabs: [
                { url: 'https://custom1.com', pinned: true, muted: false, focus: false },
                { url: 'https://custom2.com', pinned: false, muted: true, focus: true }
            ],
            closeOtherTabs: true
        };

        const result = migrateStorageConfig(legacyData);
        assert.strictEqual(result.wasMigrated, true);
        assert.strictEqual(result.windows.length, 1);
        assert.strictEqual(result.windows[0].name, 'Window 1');
        assert.strictEqual(result.windows[0].tabs.length, 2);
        assert.strictEqual(result.windows[0].tabs[0].url, 'https://custom1.com');
        assert.strictEqual(result.windows[0].tabs[1].url, 'https://custom2.com');
        assert.strictEqual(result.closeOtherTabs, true);
    });

    test('preserves modern savedWindows if already present and valid', () => {
        const modernData = {
            savedWindows: [
                {
                    id: 'win-custom-1',
                    name: 'Primary Window',
                    tabs: [{ url: 'https://work.com', pinned: true, muted: false, focus: true }]
                },
                {
                    id: 'win-custom-2',
                    name: 'Secondary Window',
                    tabs: [{ url: 'https://social.com', pinned: false, muted: true, focus: true }]
                }
            ],
            closeOtherTabs: false
        };

        const result = migrateStorageConfig(modernData);
        assert.strictEqual(result.wasMigrated, false);
        assert.strictEqual(result.windows.length, 2);
        assert.strictEqual(result.windows[0].name, 'Primary Window');
        assert.strictEqual(result.windows[1].name, 'Secondary Window');
    });

    test('ensures at least one tab is focused per window', () => {
        const unfocusedData = {
            savedWindows: [
                {
                    id: 'win-1',
                    name: 'Window 1',
                    tabs: [
                        { url: 'https://tab1.com', pinned: false, muted: false, focus: false },
                        { url: 'https://tab2.com', pinned: false, muted: false, focus: false }
                    ]
                }
            ]
        };

        const result = migrateStorageConfig(unfocusedData);
        assert.strictEqual(result.windows[0].tabs[0].focus, true);
    });
});
