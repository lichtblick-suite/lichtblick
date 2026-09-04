// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  DiagConsoleLogger,
  DiagLogLevel,
  diag,
  trace,
  type Attributes,
  type Tracer,
} from "@opentelemetry/api";
import { SeverityNumber, logs } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { BatchSpanProcessor, WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

import IAnalytics, { AppEvent } from "../IAnalytics";
import { getDeviceId, sessionId } from "./identity";
import RateLimiter, { DEFAULT_RATE_LIMITER_CONFIG, type RateLimiterConfig } from "./rateLimiter";

const DEFAULT_OTEL_ANALYTICS_RATE_LIMITER_CONFIG: RateLimiterConfig = DEFAULT_RATE_LIMITER_CONFIG;

let diagLoggerInitialized = false;

const isRejected = (result: PromiseSettledResult<unknown>): result is PromiseRejectedResult =>
  result.status === "rejected";

type ScalarAttributeValue = string | number | boolean;

function isScalarAttributeValue(value: unknown): value is ScalarAttributeValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isAttributeArray(value: unknown): value is Array<null | undefined | ScalarAttributeValue> {
  return (
    Array.isArray(value) && value.every((item) => item == undefined || isScalarAttributeValue(item))
  );
}

/**
 * Filters an arbitrary record down to values that are valid OpenTelemetry `Attributes`
 * (primitives or homogeneous arrays of primitives), dropping unsupported values such as
 * objects, functions, and mixed/nested arrays so they aren't silently mishandled by exporters.
 */
function sanitizeAttributes(data: Record<string, unknown>): Attributes {
  const sanitized: Attributes = {};
  for (const [key, value] of Object.entries(data)) {
    if (isScalarAttributeValue(value) || isAttributeArray(value)) {
      sanitized[key] = value as Attributes[string];
    } else if (value != undefined) {
      diag.warn(`OtelAnalytics: dropping unsupported attribute "${key}" of type ${typeof value}`);
    }
  }
  return sanitized;
}

function ensureDiagLogger(): void {
  if (diagLoggerInitialized) {
    return;
  }

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
  diagLoggerInitialized = true;
}

export type OtelAnalyticsOptions = {
  endpoint: string;
  version: string;
  platform: "web" | "desktop";
  rateLimiter?: RateLimiter;
};

export default class OtelAnalytics implements IAnalytics {
  readonly #loggerProvider: LoggerProvider;
  readonly #logger;
  readonly #tracerProvider: WebTracerProvider;
  readonly #tracer: Tracer;
  readonly #rateLimiter: RateLimiter;

  public constructor(options: OtelAnalyticsOptions) {
    ensureDiagLogger();
    this.#rateLimiter =
      options.rateLimiter ?? new RateLimiter(DEFAULT_OTEL_ANALYTICS_RATE_LIMITER_CONFIG);

    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "lichtblick",
      [ATTR_SERVICE_VERSION]: options.version,
      platform: options.platform,
    });

    const exporter = new OTLPLogExporter({ url: `${options.endpoint}/v1/logs` });
    this.#loggerProvider = new LoggerProvider({
      resource,
      processors: [new BatchLogRecordProcessor({ exporter })],
    });
    logs.setGlobalLoggerProvider(this.#loggerProvider);
    this.#logger = this.#loggerProvider.getLogger("lichtblick");

    const traceExporter = new OTLPTraceExporter({ url: `${options.endpoint}/v1/traces` });
    this.#tracerProvider = new WebTracerProvider({
      resource,
      spanProcessors: [new BatchSpanProcessor(traceExporter)],
    });
    trace.setGlobalTracerProvider(this.#tracerProvider);
    this.#tracer = this.#tracerProvider.getTracer("lichtblick");
  }

  public logEvent(event: AppEvent, data?: Record<string, unknown>): void {
    if (!this.#rateLimiter.allow(event)) {
      return;
    }

    const deviceId = getDeviceId();
    const attributes: Attributes = {
      ...sanitizeAttributes(data ?? {}),
      device_id: deviceId,
      session_id: sessionId,
    };

    this.#logger.emit({
      body: event,
      severityNumber: SeverityNumber.INFO,
      attributes,
    });

    const span = this.#tracer.startSpan(event, { attributes });
    span.end();
  }

  public async flush(): Promise<void> {
    const results = await Promise.allSettled([
      this.#loggerProvider.forceFlush(),
      this.#tracerProvider.forceFlush(),
    ]);
    const rejected = results.filter(isRejected);

    if (rejected.length > 0) {
      throw new AggregateError(
        rejected.map(({ reason }) => reason),
        "OtelAnalytics.flush() failed for one or more providers",
      );
    }
  }

  public async shutdown(): Promise<void> {
    const results = await Promise.allSettled([
      this.#loggerProvider.shutdown(),
      this.#tracerProvider.shutdown(),
    ]);
    const rejected = results.filter(isRejected);

    if (rejected.length > 0) {
      throw new AggregateError(
        rejected.map(({ reason }) => reason),
        "OtelAnalytics.shutdown() failed for one or more providers",
      );
    }
  }
}
