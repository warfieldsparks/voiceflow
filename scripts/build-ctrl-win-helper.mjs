import { existsSync, mkdirSync, statSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const sourcePath = resolve(rootDir, 'native', 'windows', 'ctrl_win_hotkey_helper.c');
const outputPath = resolve(rootDir, 'resources', 'bin', 'win32', 'voiceflow-ctrl-win-helper.exe');
const force = process.argv.includes('--force');

function canUse(command) {
  const result = spawnSync(command, ['--version'], { stdio: 'ignore' });
  return result.status === 0;
}

function findCompiler() {
  const candidates =
    process.platform === 'win32'
      ? ['gcc', 'clang']
      : ['x86_64-w64-mingw32-gcc', 'gcc'];

  return candidates.find(canUse) || null;
}

function isOutputFresh() {
  if (!existsSync(outputPath)) return false;
  return statSync(outputPath).mtimeMs >= statSync(sourcePath).mtimeMs;
}

if (!existsSync(sourcePath)) {
  console.error(`Missing helper source: ${sourcePath}`);
  process.exit(1);
}

if (!force && isOutputFresh()) {
  console.log(`Ctrl+Win helper is up to date: ${outputPath}`);
  process.exit(0);
}

const compiler = findCompiler();
if (!compiler) {
  if (existsSync(outputPath)) {
    console.warn(`No Windows C compiler found; using existing helper binary: ${outputPath}`);
    process.exit(0);
  }

  console.error('No suitable compiler found for the Ctrl+Win helper.');
  process.exit(1);
}

mkdirSync(dirname(outputPath), { recursive: true });

const compileArgs = [
  sourcePath,
  '-O2',
  '-s',
  '-static',
  '-o',
  outputPath,
  '-luser32',
  '-lkernel32',
];

console.log(`Building Ctrl+Win helper with ${compiler}`);
const result = spawnSync(compiler, compileArgs, { stdio: 'inherit' });
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log(`Built Ctrl+Win helper: ${outputPath}`);
