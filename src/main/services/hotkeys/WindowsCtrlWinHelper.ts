import { app } from 'electron';
import { spawn, type ChildProcessByStdio } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { createInterface, type Interface } from 'readline';
import type { Readable } from 'stream';
import { createLogger } from '../../utils/logger';

const log = createLogger('ctrl-win-helper');
const HELPER_NAME = 'voiceflow-ctrl-win-helper.exe';

type HelperCallbacks = {
  onDown: () => void;
  onUp: () => void;
  onExit?: () => void;
};

let helperProcess: ChildProcessByStdio<null, Readable, Readable> | null = null;
let helperOutput: Interface | null = null;
let helperCallbacks: HelperCallbacks | null = null;
let helperReady = false;

function getHelperPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'bin', 'win32', HELPER_NAME);
  }

  return join(app.getAppPath(), 'resources', 'bin', 'win32', HELPER_NAME);
}

export function isWindowsCtrlWinHelperActive(): boolean {
  return helperProcess !== null && helperReady;
}

export function stopWindowsCtrlWinHelper(): void {
  helperReady = false;

  if (helperOutput) {
    helperOutput.close();
    helperOutput = null;
  }

  if (helperProcess) {
    helperProcess.kill();
    helperProcess = null;
  }

  helperCallbacks = null;
}

export function startWindowsCtrlWinHelper(callbacks: HelperCallbacks): boolean {
  stopWindowsCtrlWinHelper();

  if (process.platform !== 'win32') {
    return false;
  }

  const helperPath = getHelperPath();
  if (!existsSync(helperPath)) {
    log.warn(`Ctrl+Win helper binary not found: ${helperPath}`);
    return false;
  }

  try {
    const child = spawn(helperPath, [String(process.pid)], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    helperProcess = child;
    helperCallbacks = callbacks;
    helperOutput = createInterface({ input: child.stdout });

    helperOutput.on('line', (line) => {
      const message = line.trim();
      if (!message) return;

      if (message === 'READY') {
        helperReady = true;
        log.info('Ctrl+Win helper ready');
        return;
      }

      if (message === 'DOWN') {
        helperCallbacks?.onDown();
        return;
      }

      if (message === 'UP') {
        helperCallbacks?.onUp();
        return;
      }

      log.info(`Ctrl+Win helper: ${message}`);
    });

    child.stderr.on('data', (chunk) => {
      const message = chunk.toString().trim();
      if (message) {
        log.warn(`Ctrl+Win helper stderr: ${message}`);
      }
    });

    child.on('error', (err) => {
      log.error('Ctrl+Win helper failed to start', err);
      stopWindowsCtrlWinHelper();
      callbacks.onExit?.();
    });

    child.on('exit', (code, signal) => {
      const exitingCallbacks = helperCallbacks;
      const expectedShutdown = helperProcess === null;

      helperReady = false;
      helperProcess = null;

      if (helperOutput) {
        helperOutput.close();
        helperOutput = null;
      }

      helperCallbacks = null;

      if (!expectedShutdown) {
        log.warn('Ctrl+Win helper exited unexpectedly', { code, signal });
        exitingCallbacks?.onExit?.();
      } else {
        log.info('Ctrl+Win helper stopped');
      }
    });

    log.info(`Started Ctrl+Win helper: ${helperPath}`);
    return true;
  } catch (err) {
    log.error('Unable to spawn Ctrl+Win helper', err);
    stopWindowsCtrlWinHelper();
    return false;
  }
}
