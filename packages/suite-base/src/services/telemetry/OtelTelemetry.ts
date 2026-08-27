// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Counter, Histogram, Meter, ObservableGauge } from "@opentelemetry/api";
import { Logger, SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";
import { MeterProvider, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

import { AppEvent } from "../IAnalytics";
import ITelemetry, { Attributes, MetricName } from "../ITelemetry";
import {
  METRIC_UNITS,
  attributesCacheKey,
  getEventCounterName,
  sanitizeMetricAttributes,
} from "./eventRouting";
import { getDeviceId, sessionId } from "./identity";

const METRIC_EXPORT_INTERVAL_MS = 30_000;

/** `recordDuration()` takes milliseconds, so histograms are always declared in `ms` (UCUM). */
const DURATION_HISTOGRAM_UNIT = "ms";

export type OtelTelemetryOptions = {
  /** Base URL of the OTLP/HTTP collector, e.g. http://localhost:4318 (see docs/telemetry/poc). */
  endpoint: string;
  version: string;
  platform: "web" | "desktop";
  osType: string;
};

/**
 * `ITelemetry` implementation backed by the OpenTelemetry JS SDK, exporting via OTLP/HTTP to the
 * collector described in docs/telemetry/poc/otel-collector.yaml. See
 * docs/telemetry/poc-opentelemetry-plano.md for the full design and rationale.
 */
export default class OtelTelemetry implements ITelemetry {
  readonly #meterProvider: MeterProvider;
  readonly #loggerProvider: LoggerProvider;
  readonly #meter: Meter;
  readonly #logger: Logger;
  readonly #counters = new Map<string, Counter>();
  readonly #histograms = new Map<string, Histogram>();
  readonly #gauges = new Map<
    string,
    { gauge: ObservableGauge; values: Map<string, { value: number; attrs: Attributes }> }
  >();

  public constructor(options: OtelTelemetryOptions) {
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: "lichtblick",
      [ATTR_SERVICE_VERSION]: options.version,
      platform: options.platform,
      os_type: options.osType,
    });

    const metricExporter = new OTLPMetricExporter({ url: `${options.endpoint}/v1/metrics` });
    this.#meterProvider = new MeterProvider({
      resource,
      readers: [
        new PeriodicExportingMetricReader({
          exporter: metricExporter,
          exportIntervalMillis: METRIC_EXPORT_INTERVAL_MS,
        }),
      ],
    });
    this.#meter = this.#meterProvider.getMeter("lichtblick");

    const logExporter = new OTLPLogExporter({ url: `${options.endpoint}/v1/logs` });
    this.#loggerProvider = new LoggerProvider({
      resource,
      processors: [new BatchLogRecordProcessor({ exporter: logExporter })],
    });
    this.#logger = this.#loggerProvider.getLogger("lichtblick");
  }

  public logEvent(event: AppEvent, data?: Attributes): void {
    // device_id/session_id go in the log body's attributes only, never as a metric label.
    this.#logger.emit({
      body: event,
      severityNumber: SeverityNumber.INFO,
      attributes: { ...data, device_id: getDeviceId(), session_id: sessionId },
    });

    const counterName = getEventCounterName(event);
    if (counterName) {
      this.#getCounter(counterName).add(1, sanitizeMetricAttributes(data, event));
    }
  }

  public recordValue(metric: MetricName, value: number, attrs?: Attributes): void {
    const sanitized = sanitizeMetricAttributes(attrs);
    let entry = this.#gauges.get(metric);
    if (!entry) {
      const values = new Map<string, { value: number; attrs: Attributes }>();
      const gauge = this.#meter.createObservableGauge(metric, { unit: METRIC_UNITS[metric] });
      gauge.addCallback((result) => {
        for (const { value: storedValue, attrs: storedAttrs } of values.values()) {
          result.observe(storedValue, storedAttrs);
        }
      });
      entry = { gauge, values };
      this.#gauges.set(metric, entry);
    }
    entry.values.set(attributesCacheKey(sanitized), { value, attrs: sanitized });
  }

  public recordDuration(metric: MetricName, ms: number, attrs?: Attributes): void {
    this.#getHistogram(metric).record(ms, sanitizeMetricAttributes(attrs));
  }

  public incrementCounter(name: string, attrs?: Attributes): void {
    this.#getCounter(name).add(1, sanitizeMetricAttributes(attrs));
  }

  public async flush(): Promise<void> {
    await Promise.all([this.#meterProvider.forceFlush(), this.#loggerProvider.forceFlush()]);
  }

  #getCounter(name: string): Counter {
    let counter = this.#counters.get(name);
    if (!counter) {
      counter = this.#meter.createCounter(name);
      this.#counters.set(name, counter);
    }
    return counter;
  }

  #getHistogram(name: MetricName): Histogram {
    let histogram = this.#histograms.get(name);
    if (!histogram) {
      histogram = this.#meter.createHistogram(name, { unit: DURATION_HISTOGRAM_UNIT });
      this.#histograms.set(name, histogram);
    }
    return histogram;
  }
}
