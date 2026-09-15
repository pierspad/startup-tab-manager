#!/usr/bin/env node
const { execSync } = require('child_process');

const issuer = process.env.AMO_JWT_ISSUER;
const secret = process.env.AMO_JWT_SECRET;

if (!issuer || !secret) {
    console.log('ℹ️ AMO_JWT_ISSUER or AMO_JWT_SECRET not found in environment.');
    console.log('ℹ️ Skipping Mozilla Add-ons (AMO) automated store submission.');
    console.log('ℹ️ The GitHub Release package (.zip) has been built and attached successfully.');
    process.exit(0);
}

console.log('🚀 Submitting updated extension to Mozilla Add-ons (AMO)...');
try {
    execSync(
        `npx web-ext sign --api-key="${issuer}" --api-secret="${secret}" --channel=listed --source-dir=. --artifacts-dir=web-ext-signed-artifacts`,
        { stdio: 'inherit' }
    );
    console.log('✅ Extension successfully submitted/signed on Mozilla Add-ons store!');
} catch (err) {
    console.error('❌ Failed to upload extension to Mozilla Add-ons:', err.message);
    process.exit(1);
}
