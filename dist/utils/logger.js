export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel || (LogLevel = {}));
const LEVEL_LABEL = {
    [LogLevel.DEBUG]: "DEBUG",
    [LogLevel.INFO]: "INFO",
    [LogLevel.WARN]: "WARN",
    [LogLevel.ERROR]: "ERROR",
};
export class Logger {
    constructor(module, level = LogLevel.INFO) {
        this.module = module;
        this.level = level;
    }
    shouldLog(level) {
        return level >= this.level;
    }
    write(level, message, args) {
        if (!this.shouldLog(level))
            return;
        const timestamp = new Date().toISOString();
        let line = `[${timestamp}] [${this.module}] ${LEVEL_LABEL[level]}: ${message}`;
        if (args.length) {
            const extra = args
                .map((a) => a instanceof Error
                ? `${a.message}\n${a.stack ?? ""}`
                : typeof a === "object"
                    ? JSON.stringify(a, null, 2)
                    : String(a))
                .join(" ");
            line += ` ${extra}`;
        }
        if (level >= LogLevel.WARN) {
            process.stderr.write(line + "\n");
        }
        else {
            process.stdout.write(line + "\n");
        }
    }
    debug(message, ...args) {
        this.write(LogLevel.DEBUG, message, args);
    }
    info(message, ...args) {
        this.write(LogLevel.INFO, message, args);
    }
    warn(message, ...args) {
        this.write(LogLevel.WARN, message, args);
    }
    error(message, ...args) {
        this.write(LogLevel.ERROR, message, args);
    }
}
export const createLogger = (module, level) => {
    return new Logger(module, level);
};
export const logger = createLogger("App");
//# sourceMappingURL=logger.js.map