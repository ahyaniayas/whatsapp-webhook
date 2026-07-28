const fs = require('fs');
const path = require('path');

const root = process.cwd();
const release = path.join(root, 'dist-release');

fs.mkdirSync(release, { recursive: true });

function copy(src, dest) {
    if (!fs.existsSync(src)) return;

    fs.cpSync(src, dest, {
        recursive: true,
        force: true
    });

    console.log(`Copied ${src}`);
}

// file wajib
copy('package.json', path.join(release, 'package.json'));
copy('yarn.lock', path.join(release, 'yarn.lock'));
copy('.yarnrc.yml', path.join(release, '.yarnrc.yml'));
copy('.yarn', path.join(release, '.yarn'));

// opsional
copy('ecosystem.config.js', path.join(release, 'ecosystem.config.js'));
copy('public', path.join(release, 'public'));
copy('templates', path.join(release, 'templates'));
copy('migrations', path.join(release, 'migrations'));
copy('prisma', path.join(release, 'prisma'));

// jangan copy .env
