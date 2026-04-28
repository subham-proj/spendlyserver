import { Registry, Counter, Histogram } from "prom-client";
export declare const register: Registry<"text/plain; version=0.0.4; charset=utf-8">;
export declare const httpRequestDuration: Histogram<"route" | "method" | "status_code">;
export declare const webhookReceived: Counter<string>;
export declare const emailJobsQueued: Counter<string>;
//# sourceMappingURL=metrics.d.ts.map