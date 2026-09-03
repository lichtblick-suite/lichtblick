/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import "@testing-library/jest-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import Log from "@lichtblick/log";
import { APP_CONFIG } from "@lichtblick/suite-base/constants/config";
import { useAnalytics } from "@lichtblick/suite-base/context/AnalyticsContext";
import { AppEvent } from "@lichtblick/suite-base/services/IAnalytics";
import NullAnalytics from "@lichtblick/suite-base/services/NullAnalytics";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";

import AnalyticsProvider from "./AnalyticsProvider";

const mockLogEvent = jest.fn();
const mockFlush = jest.fn().mockResolvedValue(undefined);
const mockShutdown = jest.fn().mockResolvedValue(undefined);
const mockOtelAnalyticsInstance = {
  logEvent: mockLogEvent,
  flush: mockFlush,
  shutdown: mockShutdown,
};
const mockOtelAnalytics = jest.fn((_options: unknown) => mockOtelAnalyticsInstance);

jest.mock("@lichtblick/log", () => ({
  __esModule: true,
  default: (() => {
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    return {
      getLogger: jest.fn(() => logger),
    };
  })(),
}));

jest.mock("@lichtblick/suite-base/constants/config", () => ({
  APP_CONFIG: {
    version: "1.2.3",
    otlpEndpoint: undefined,
  },
}));

jest.mock("@lichtblick/suite-base/util/isDesktopApp", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("@lichtblick/suite-base/services/telemetry/OtelAnalytics", () => ({
  __esModule: true,
  default: function MockOtelAnalytics(options: unknown) {
    return mockOtelAnalytics(options);
  },
}));

function AnalyticsConsumer(): React.JSX.Element {
  const analytics = useAnalytics();

  return (
    <>
      <div data-testid="analytics-kind">
        {analytics instanceof NullAnalytics ? "null" : "otel"}
      </div>
      <button type="button" onClick={() => { analytics.logEvent(AppEvent.APP_INIT); }}>
        emit
      </button>
    </>
  );
}

type MockLogger = {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

type MockLogModule = {
  getLogger: jest.MockedFunction<(name: string) => MockLogger>;
};

describe("AnalyticsProvider", () => {
  const mockAppConfig = APP_CONFIG as { version: string; otlpEndpoint: string | undefined };
  const mockLog = Log as unknown as MockLogModule;
  const mockIsDesktopApp = isDesktopApp as jest.MockedFunction<typeof isDesktopApp>;
  const getMockLogger = (): MockLogger => mockLog.getLogger("test");

  beforeEach(() => {
    jest.clearAllMocks();
    mockAppConfig.version = "1.2.3";
    mockAppConfig.otlpEndpoint = undefined;
    mockIsDesktopApp.mockReturnValue(false);
    mockOtelAnalytics.mockImplementation(() => mockOtelAnalyticsInstance);
  });

  it("renders its children", () => {
    // When
    render(
      <AnalyticsProvider>
        <div data-testid="child">child</div>
      </AnalyticsProvider>,
    );

    // Then
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("provides NullAnalytics when no OTLP endpoint is configured", () => {
    // When
    render(
      <AnalyticsProvider>
        <AnalyticsConsumer />
      </AnalyticsProvider>,
    );

    // Then
    const mockLogger = getMockLogger();
    expect(screen.getByTestId("analytics-kind")).toHaveTextContent("null");
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "No OTLP endpoint was compiled in; analytics events will not be exported.",
    );
    expect(mockOtelAnalytics).not.toHaveBeenCalled();
  });

  it("provides an OpenTelemetry-backed analytics instance when an OTLP endpoint is configured", async () => {
    // Given
    mockAppConfig.otlpEndpoint = "http://collector:4318";

    // When
    render(
      <AnalyticsProvider>
        <AnalyticsConsumer />
      </AnalyticsProvider>,
    );

    // Then
    await waitFor(() => {
      expect(screen.getByTestId("analytics-kind")).toHaveTextContent("otel");
    });
    expect(mockOtelAnalytics).toHaveBeenCalledWith({
      endpoint: "http://collector:4318",
      version: "1.2.3",
      platform: "web",
    });

    fireEvent.click(screen.getByRole("button", { name: "emit" }));
    expect(mockLogEvent).toHaveBeenCalledWith(AppEvent.APP_INIT);
  });

  it("flushes and shuts down the analytics instance on unmount", async () => {
    // Given
    mockAppConfig.otlpEndpoint = "http://collector:4318";

    const { unmount } = render(
      <AnalyticsProvider>
        <AnalyticsConsumer />
      </AnalyticsProvider>,
    );

    await waitFor(() => {
      expect(mockOtelAnalytics).toHaveBeenCalledTimes(1);
    });

    // When
    unmount();

    // Then
    await waitFor(() => {
      expect(mockFlush).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockShutdown).toHaveBeenCalledTimes(1);
    });
  });
});
