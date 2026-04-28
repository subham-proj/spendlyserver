import { Registry, collectDefaultMetrics, Counter, Histogram } from "prom-client";

export const register = new Registry();

// Default Node.js metrics: CPU, memory, GC, event loop lag, etc.
collectDefaultMetrics({ register });

// HTTP request duration per route/method/status
export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
  registers: [register],
});

// Gmail Pub/Sub webhook notifications received
export const webhookReceived = new Counter({
  name: "gmail_webhook_received_total",
  help: "Total Gmail Pub/Sub webhook notifications received",
  registers: [register],
});

// Emails enqueued for processing
export const emailJobsQueued = new Counter({
  name: "gmail_jobs_queued_total",
  help: "Total email jobs added to the BullMQ processing queue",
  registers: [register],
});
