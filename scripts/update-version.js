#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const newVersion = process.argv[2];
if (!newVersion) {
    console.error('Usage: node scripts/update-version.js <version>');
    process.exit(1);
}

// Update manifest.json
// Mozilla WebExtensions require version to be 1 to 4 dot-separated integers (no letters or hyphens)
let manifestVersion = newVersion;
if (manifestVersion.includes('-')) {
    const [base, pre] = manifestVersion.split('-');
    const preNumMatch = pre.match(/\d+/);
    const preNum = preNumMatch ? preNumMatch[0] : '1';
    manifestVersion = `${base}.${preNum}`;
}

const manifestPath = path.resolve(__dirname, '..', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
manifest.version = manifestVersion;
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`Updated manifest.json to version ${manifestVersion} (raw semver: ${newVersion})`);

// Update package.json
const pkgPath = path.resolve(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`Updated package.json to version ${newVersion}`);
