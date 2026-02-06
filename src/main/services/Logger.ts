import log from 'electron-log';

// Configure file transport
log.transports.file.maxSize = 10 * 1024 * 1024; // 10MB
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.file.fileName = 'main.log';

// Console transport uses same format
log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

export const logger = {
  info: (...args: unknown[]) => log.info(...args),
  warn: (...args: unknown[]) => log.warn(...args),
  error: (...args: unknown[]) => log.error(...args),
  debug: (...args: unknown[]) => log.debug(...args),

  logMemory(): void {
    const mem = process.memoryUsage();
    log.info(
      `Memory: heapUsed=${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB, ` +
      `heapTotal=${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB, ` +
      `rss=${(mem.rss / 1024 / 1024).toFixed(1)}MB, ` +
      `external=${(mem.external / 1024 / 1024).toFixed(1)}MB`
    );
  },
};
