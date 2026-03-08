import { app } from 'electron';
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'fs';
import { join } from 'path';
import { inspect } from 'util';
import type { LogEventPayload, LogLevel } from '../../shared/types';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const originalConsole = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

const LOG_FILE_MAX_BYTES = 5 * 1024 * 1024;

let currentLevel: LogLevel = (process.env.VOICEFLOW_LOG_LEVEL as LogLevel) || 'debug';
let logFilePath: string | null = null;
let processHandlersInstalled = false;
let bootBuffer: string[] = [];

function setLevel(level: LogLevel) {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function normalizeDetails(args: unknown[]): unknown {
  if (args.length === 0) return undefined;
  if (args.length === 1) return args[0];
  return args;
}

function normalizeLevel(level: string): LogLevel {
  return level === 'debug' || level === 'info' || level === 'warn' || level === 'error'
    ? level
    : 'info';
}

function serializeValue(value: unknown): string {
  if (value instanceof Error) {
    return inspect(
      {
        name: value.name,
        message: value.message,
        stack: value.stack,
      },
      { depth: 6, breakLength: 140, compact: true }
    );
  }

  if (typeof value === 'string') return value;

  return inspect(value, {
    depth: 6,
    breakLength: 140,
    compact: true,
    maxArrayLength: 30,
  });
}

function formatLine(
  level: LogLevel,
  tag: string,
  message: string,
  details?: unknown,
  source: 'main' | 'renderer' | 'preload' = 'main'
): string {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [${source}:${tag}] ${message}`;
  if (details === undefined) return prefix;
  return `${prefix} ${serializeValue(details)}`;
}

function rotateLogFileIfNeeded(filePath: string): void {
  if (!existsSync(filePath)) return;

  try {
    if (statSync(filePath).size < LOG_FILE_MAX_BYTES) return;
  } catch {
    return;
  }

  const rotatedPath = `${filePath}.1`;
  try {
    if (existsSync(rotatedPath)) {
      renameSync(rotatedPath, `${filePath}.2`);
    }
  } catch {
    // Ignore rotation failures and keep logging to the main file.
  }

  try {
    renameSync(filePath, rotatedPath);
  } catch {
    // Ignore rotation failures and keep logging to the main file.
  }
}

function ensureLogFileReady(): void {
  if (logFilePath || !app.isReady()) return;

  const logDir = join(app.getPath('userData'), 'logs');
  mkdirSync(logDir, { recursive: true });

  const dayStamp = new Date().toISOString().slice(0, 10);
  const filePath = join(logDir, `voiceflow-${dayStamp}.log`);
  rotateLogFileIfNeeded(filePath);
  logFilePath = filePath;

  const sessionHeader =
    `\n===== Session ${new Date().toISOString()} pid=${process.pid} ` +
    `version=${app.getVersion()} electron=${process.versions.electron} node=${process.versions.node} =====\n`;
  appendFileSync(logFilePath, sessionHeader, 'utf8');

  if (bootBuffer.length > 0) {
    appendFileSync(logFilePath, `${bootBuffer.join('\n')}\n`, 'utf8');
    bootBuffer = [];
  }
}

function writeLineToDisk(line: string): void {
  ensureLogFileReady();

  if (!logFilePath) {
    bootBuffer.push(line);
    return;
  }

  try {
    appendFileSync(logFilePath, `${line}\n`, 'utf8');
  } catch (err) {
    originalConsole.error('[logger] Failed to write log file', err);
  }
}

function emit(
  level: LogLevel,
  tag: string,
  message: string,
  details?: unknown,
  source: 'main' | 'renderer' | 'preload' = 'main'
): void {
  if (!shouldLog(level)) return;

  const line = formatLine(level, tag, message, details, source);
  originalConsole[level](line);
  writeLineToDisk(line);
}

function createLogger(tag: string, source: 'main' | 'renderer' | 'preload' = 'main') {
  return {
    debug: (msg: string, ...args: unknown[]) => emit('debug', tag, msg, normalizeDetails(args), source),
    info: (msg: string, ...args: unknown[]) => emit('info', tag, msg, normalizeDetails(args), source),
    warn: (msg: string, ...args: unknown[]) => emit('warn', tag, msg, normalizeDetails(args), source),
    error: (msg: string, ...args: unknown[]) => emit('error', tag, msg, normalizeDetails(args), source),
  };
}

export function initLogging(): string | null {
  ensureLogFileReady();
  return logFilePath;
}

export function getLogFilePath(): string | null {
  ensureLogFileReady();
  return logFilePath;
}

export function logExternalEvent(payload: LogEventPayload): void {
  emit(
    normalizeLevel(payload.level),
    payload.tag || 'external',
    payload.message || 'Log event',
    payload.details,
    payload.source || 'renderer'
  );
}

export function installProcessErrorLogging(): void {
  if (processHandlersInstalled) return;
  processHandlersInstalled = true;

  process.on('uncaughtException', (err) => {
    emit('error', 'process', 'Uncaught exception', err);
  });

  process.on('unhandledRejection', (reason) => {
    emit('error', 'process', 'Unhandled promise rejection', reason);
  });
}

export { createLogger, setLevel };
