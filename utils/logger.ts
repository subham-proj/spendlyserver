import colors from "colors";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private module: string;
  private level: LogLevel;

  constructor(module: string, level: LogLevel = LogLevel.INFO) {
    this.module = module;
    this.level = level;
  }

  private formatMessage(
    level: string,
    message: string,
    ...args: any[]
  ): string {
    const timestamp = new Date().toISOString();
    const formattedMessage = `[${timestamp}] [${this.module}] ${level}: ${message}`;
    return formattedMessage;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(colors.gray(this.formatMessage("DEBUG", message, ...args)));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(colors.blue(this.formatMessage("INFO", message, ...args)));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(colors.yellow(this.formatMessage("WARN", message, ...args)));
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(colors.red(this.formatMessage("ERROR", message, ...args)));
    }
  }
}

// Factory function to create loggers for different modules
export const createLogger = (module: string, level?: LogLevel): Logger => {
  return new Logger(module, level);
};

// Default logger instance
export const logger = createLogger("App");
