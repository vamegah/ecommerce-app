const { spawnSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const vitestArgs = args.length > 0 ? args : ['--run', '--config', 'vitest.config.js'];

if (process.platform !== 'win32') {
  const result = spawnSync('node', [path.join('node_modules', 'vitest', 'vitest.mjs'), ...vitestArgs], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });
  process.exit(result.status ?? 1);
}

const drive = process.env.ADDRESSES_TEST_DRIVE || 'X:';
const root = process.cwd();

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    stdio: 'inherit',
    ...options,
  });
}

run('cmd.exe', ['/c', 'subst', drive, '/D'], { stdio: 'ignore' });
const mapResult = run('cmd.exe', ['/c', 'subst', drive, root], { stdio: 'ignore' });
if (mapResult.status !== 0) {
  console.error(`Unable to map ${drive} to ${root}`);
  process.exit(mapResult.status ?? 1);
}

try {
  const result = run(
    'node',
    [path.join('node_modules', 'vitest', 'vitest.mjs'), ...vitestArgs],
    { cwd: `${drive}\\` }
  );
  process.exitCode = result.status ?? 1;
} finally {
  run('cmd.exe', ['/c', 'subst', drive, '/D'], { stdio: 'ignore' });
}
