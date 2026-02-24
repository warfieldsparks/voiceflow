type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentLevel: LogLevel = 'info';

function setLevel(level: LogLevel) {
  currentLevel = level;
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function formatMessage(level: LogLevel, tag: string, message: string): string {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level.toUpperCase()}] [${tag}] ${message}`;
}

function createLogger(tag: string) {
  return {
    debug: (msg: string, ...args: unknown[]) => {
      if (shouldLog('debug')) console.debug(formatMessage('debug', tag, msg), ...args);
    },
    info: (msg: string, ...args: unknown[]) => {
      if (shouldLog('info')) console.info(formatMessage('info', tag, msg), ...args);
    },
    warn: (msg: string, ...args: unknown[]) => {
      if (shouldLog('warn')) console.warn(formatMessage('warn', tag, msg), ...args);
    },
    error: (msg: string, ...args: unknown[]) => {
      if (shouldLog('error')) console.error(formatMessage('error', tag, msg), ...args);
    },
  };
}

export { createLogger, setLevel };
