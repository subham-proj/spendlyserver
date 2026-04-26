import IORedis from "ioredis";
import { createLogger } from "../utils/logger.js";
const logger = createLogger("Redis");
const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
export const redisConnection = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null, // required by BullMQ
});
redisConnection.on("connect", () => logger.info(`Connected to Redis at ${REDIS_URL}`));
redisConnection.on("ready", () => logger.info("Redis connection ready"));
redisConnection.on("error", (err) => logger.error("Redis connection error:", err));
redisConnection.on("close", () => logger.warn("Redis connection closed"));
redisConnection.on("reconnecting", () => logger.warn("Redis reconnecting..."));
//# sourceMappingURL=connection.js.map