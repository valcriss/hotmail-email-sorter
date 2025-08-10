import 'dotenv/config';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

class Logger {
  private level: LogLevel;

  constructor() {
    const logLevelStr = process.env.LOG_LEVEL?.toLowerCase() || 'info';
    
    switch (logLevelStr) {
      case 'error':
        this.level = LogLevel.ERROR;
        break;
      case 'warn':
      case 'warning':
        this.level = LogLevel.WARN;
        break;
      case 'info':
        this.level = LogLevel.INFO;
        break;
      case 'debug':
        this.level = LogLevel.DEBUG;
        break;
      default:
        this.level = LogLevel.INFO;
        break;
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private formatMessage(level: string, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    
    if (args.length > 0) {
      console.log(prefix, message, ...args);
    } else {
      console.log(prefix, message);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.formatMessage('ERROR', `❌ ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.formatMessage('WARN', `⚠️ ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.formatMessage('INFO', message, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.formatMessage('DEBUG', `🔍 ${message}`, ...args);
    }
  }

  // Méthodes de compatibilité pour conserver les émojis existants
  success(message: string, ...args: any[]): void {
    this.info(`✅ ${message}`, ...args);
  }

  progress(message: string, ...args: any[]): void {
    this.info(`🔄 ${message}`, ...args);
  }

  auth(message: string, ...args: any[]): void {
    this.info(`🔐 ${message}`, ...args);
  }

  mail(message: string, ...args: any[]): void {
    this.info(`📧 ${message}`, ...args);
  }

  folder(message: string, ...args: any[]): void {
    this.info(`📁 ${message}`, ...args);
  }

  stats(message: string, ...args: any[]): void {
    this.info(`📊 ${message}`, ...args);
  }

  robot(message: string, ...args: any[]): void {
    this.info(`🤖 ${message}`, ...args);
  }

  goodbye(message: string, ...args: any[]): void {
    this.info(`👋 ${message}`, ...args);
  }
}

export const logger = new Logger();
