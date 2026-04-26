export declare enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}
export declare class Logger {
    private module;
    private level;
    constructor(module: string, level?: LogLevel);
    private shouldLog;
    private write;
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
}
export declare const createLogger: (module: string, level?: LogLevel) => Logger;
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map