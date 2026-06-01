import { spawnSync } from 'node:child_process';

const result = spawnSync('gofmt', ['-l', 'cmd', 'internal'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'inherit'],
});

if (result.error) {
  console.error(`gofmt failed: ${result.error.message}`);
  process.exit(1);
}

const files = result.stdout.trim();
if (files) {
  console.error(`Go files need formatting:\n${files}`);
  process.exit(1);
}
