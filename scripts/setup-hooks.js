#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const gitDir = path.resolve(__dirname, '..', '.git');
const hooksDir = path.join(gitDir, 'hooks');
const preCommitPath = path.join(hooksDir, 'pre-commit');

if (!fs.existsSync(gitDir)) {
    console.log('No .git directory found. Skipping pre-commit hook installation.');
    process.exit(0);
}

if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
}

const hookContent = `#!/bin/sh
# Startup Tab Manager - Pre-commit Hook
echo "🔍 Running pre-commit checks (lint & tests)..."

npm run check
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
    echo "❌ Pre-commit validation failed! Fix errors before committing."
    exit 1
fi

echo "✅ All checks passed!"
exit 0
`;

try {
    fs.writeFileSync(preCommitPath, hookContent, { encoding: 'utf8', mode: 0o755 });
    fs.chmodSync(preCommitPath, 0o755);
    console.log('✅ Git pre-commit hook installed successfully in .git/hooks/pre-commit');
} catch (err) {
    console.error('Failed to install pre-commit hook:', err.message);
}
