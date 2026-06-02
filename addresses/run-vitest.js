const { spawnSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const vitestArgs = args.length > 0 ? args : ['--run', '--config', 'vitest.config.js'];

const result = spawnSync(
  'node',
  [path.join('node_modules', 'vitest', 'vitest.mjs'), ...vitestArgs],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
  }
);

process.exit(result.status ?? 1);
