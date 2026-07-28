const fs = require('fs');
const path = require('path');

const root = process.cwd();
const release = path.join(root, 'dist-release');

fs.rmSync(release, { recursive: true, force: true });

console.log(`Cleaned ${release}`);
