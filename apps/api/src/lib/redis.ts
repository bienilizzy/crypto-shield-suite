import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.redisUrl, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

// Without a listener, ioredis's "error" event (e.g. Redis not running locally)
// becomes an unhandled exception and crashes the process. Callers already
// treat cache misses as soft failures via .catch().
redis.on("error", (err) => {
  console.error("Redis connection error:", err.message);
});
