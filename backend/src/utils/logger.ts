/**
 * Logger Utility
 *
 * Simple logging utility with different log levels and context support.
 * In production, this could be replaced with Winston, Pino, or similar.
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export class Logger {
  private context: string;
  private logLevel: LogLevel;

  constructor(context: string) {
    this.context = context;
    this.logLevel = this.getLogLevel();
  }

  private getLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    return (LogLevel[level.toUpperCase() as keyof typeof LogLevel] || LogLevel.INFO);
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}${metaStr}`;
  }

  public debug(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, meta));
    }
  }

  public info(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage(LogLevel.INFO, message, meta));
    }
  }

  public warn(message: string, meta?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message, meta));
    }
  }

  public error(message: string, error?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      const errorDetails = error instanceof Error
        ? { message: error.message, stack: error.stack }
        : error;
      console.error(this.formatMessage(LogLevel.ERROR, message, errorDetails));
    }
  }
}
