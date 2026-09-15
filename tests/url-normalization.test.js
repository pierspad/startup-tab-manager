const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeUrl } = require('../utils.js');

describe('URL Normalization', () => {
    test('normalizes standard http and https URLs and strips www prefix', () => {
        assert.strictEqual(
            normalizeUrl('https://www.wikipedia.org/'),
            'wikipedia.org'
        );
        assert.strictEqual(
            normalizeUrl('http://www.wikipedia.org'),
            'wikipedia.org'
        );
        assert.strictEqual(
            normalizeUrl('https://wikipedia.org/wiki/Main_Page'),
            'wikipedia.org/wiki/Main_Page'
        );
    });

    test('strips trailing slashes from path', () => {
        assert.strictEqual(
            normalizeUrl('https://github.com/pierspad/'),
            'github.com/pierspad'
        );
        assert.strictEqual(
            normalizeUrl('https://github.com/pierspad'),
            'github.com/pierspad'
        );
    });

    test('preserves query parameters and hashes', () => {
        assert.strictEqual(
            normalizeUrl('https://youtube.com/watch?v=12345#t=10'),
            'youtube.com/watch?v=12345#t=10'
        );
    });

    test('handles special browser new tab URLs', () => {
        assert.strictEqual(normalizeUrl('about:newtab'), 'kJ_NEW_TAB_kJ');
        assert.strictEqual(normalizeUrl('chrome://newtab/'), 'kJ_NEW_TAB_kJ');
        assert.strictEqual(normalizeUrl(''), 'kJ_NEW_TAB_kJ');
        assert.strictEqual(normalizeUrl(null), 'kJ_NEW_TAB_kJ');
        assert.strictEqual(normalizeUrl(undefined), 'kJ_NEW_TAB_kJ');
    });

    test('handles non-standard or relative URLs gracefully without crashing', () => {
        assert.strictEqual(normalizeUrl('custom-page/test/'), 'custom-page/test');
    });
});
