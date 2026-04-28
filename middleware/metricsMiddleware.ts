import { Request, Response, NextFunction } from "express";
import { httpRequestDuration } from "../utils/metrics.js";

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const end = httpRequestDuration.startTimer();

  res.on("finish", () => {
    // Use the matched route pattern (e.g. /api/transactions) to avoid
    // high cardinality from query params or dynamic path segments.
    const route = req.route ? req.baseUrl + req.route.path : req.path;
    end({
      method: req.method,
      route,
      status_code: String(res.statusCode),
    });
  });

  next();
};
