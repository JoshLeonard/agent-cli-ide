import { logger } from './Logger';
import { sessionRegistry } from './SessionRegistry';
import { processManager } from './ProcessManager';

const INTERVAL_MS = 60_000; // 60 seconds

class HealthMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.timer) return;

    logger.info('HealthMonitor started');
    this.timer = setInterval(() => this.snapshot(), INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('HealthMonitor stopped');
    }
  }

  private snapshot(): void {
    logger.logMemory();
    logger.info(`Sessions: ${sessionRegistry.listSessions().length} active`);
    logger.info(`PTY processes: ${processManager.getProcessCount()} active`);
  }
}

export const healthMonitor = new HealthMonitor();
