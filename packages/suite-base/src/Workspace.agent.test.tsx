/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { act, renderHook } from "@testing-library/react";
import { StrictMode, useCallback, useLayoutEffect, useMemo, useRef } from "react";

import { AgentConfiguration } from "@lichtblick/suite-base/services/agent/agentSettings";
import { useLocalAgentClient } from "@lichtblick/suite-base/services/agent/localAgentClient";
import { PiAgentOrchestrator } from "@lichtblick/suite-base/services/agent/pi/PiAgentOrchestrator";
import type { AgentDataQueryContext } from "@lichtblick/suite-base/services/agent/tools/toolRuntime";

const validConfiguration: AgentConfiguration = {
  apiKey: "test-api-key",
  baseUrl: "",
  desktop: false,
  model: "claude-test",
  provider: "anthropic",
};

beforeAll(() => {
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: jest.fn(),
    writable: true,
  });
});

describe("local Agent client lifecycle", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("uses the latest catalog without rebuilding the client", () => {
    const { result, rerender } = renderHook(
      ({ catalogVersion }: { catalogVersion: number }) => {
        const catalogRef = useRef(catalogVersion);
        useLayoutEffect(() => {
          catalogRef.current = catalogVersion;
        });
        const getCatalog = useCallback(
          () => ({
            datatypes: new Map(),
            topics: [{ name: `/catalog/${catalogRef.current}`, schemaName: "test" }],
          }),
          [],
        );
        const client = useLocalAgentClient(validConfiguration, {
          enabled: true,
          getCatalog,
        });
        return { client, getCatalog };
      },
      { initialProps: { catalogVersion: 1 } },
    );
    const initialClient = result.current.client;
    expect(initialClient).toBeInstanceOf(PiAgentOrchestrator);

    rerender({ catalogVersion: 2 });

    expect(result.current.client).toBe(initialClient);
    expect(result.current.getCatalog().topics[0]).toEqual({
      name: "/catalog/2",
      schemaName: "test",
    });
  });

  it("disposes replaced, disabled, and unmounted orchestrators", async () => {
    const dispose = jest.spyOn(PiAgentOrchestrator.prototype, "dispose");
    const { result, rerender, unmount } = renderHook(
      ({
        enabled,
        model,
      }: {
        enabled: boolean;
        model: string;
      }) =>
        useLocalAgentClient({ ...validConfiguration, model }, {
          enabled,
          getCatalog: () => ({ datatypes: new Map(), topics: [] }),
        }),
      { initialProps: { enabled: true, model: "model-1" } },
    );
    const firstClient = result.current;

    rerender({ enabled: true, model: "model-2" });
    expect(result.current).not.toBe(firstClient);
    await act(async () => {
      await Promise.resolve();
    });
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(dispose.mock.instances[0]).toBe(firstClient);

    const secondClient = result.current;
    rerender({ enabled: false, model: "model-2" });
    expect(result.current).toBeUndefined();
    await act(async () => {
      await Promise.resolve();
    });
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(dispose.mock.instances[1]).toBe(secondClient);

    rerender({ enabled: true, model: "model-3" });
    const thirdClient = result.current;
    unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(dispose).toHaveBeenCalledTimes(3);
    expect(dispose.mock.instances[2]).toBe(thirdClient);
  });

  it("replaces the orchestrator when the selected profile changes", async () => {
    const dispose = jest.spyOn(PiAgentOrchestrator.prototype, "dispose");
    const { result, rerender } = renderHook(
      ({ profileId }: { profileId: string }) =>
        useLocalAgentClient(validConfiguration, {
          enabled: true,
          getCatalog: () => ({ datatypes: new Map(), topics: [] }),
          profileId,
        }),
      { initialProps: { profileId: "profile-1" } },
    );
    const firstClient = result.current;

    rerender({ profileId: "profile-2" });

    expect(result.current).not.toBe(firstClient);
    await act(async () => {
      await Promise.resolve();
    });
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(dispose.mock.instances[0]).toBe(firstClient);
  });

  it("disposes both committed StrictMode instances without leaking either one", async () => {
    const dispose = jest.spyOn(PiAgentOrchestrator.prototype, "dispose");
    const wrapper = ({ children }: React.PropsWithChildren) => (
      <StrictMode>{children}</StrictMode>
    );
    const { unmount } = renderHook(
      () =>
        useLocalAgentClient(validConfiguration, {
          enabled: true,
          getCatalog: () => ({ datatypes: new Map(), topics: [] }),
        }),
      { wrapper },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(dispose).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(dispose).toHaveBeenCalledTimes(2);
  });

  it("keeps the client stable while the data source loads (catalog + player changes)", async () => {
    // Simulates the Workspace wiring during a data-source load: the catalog content changes
    // (open_data_source → catalog-ready) and the player state changes, but every dependency of
    // useLocalAgentClient is either stable (dataQuery via useMemo, getters via useLatest*)
    // or independent of the data source (agent configuration, profile). The client must neither
    // be rebuilt nor released — that is the window that previously wiped the conversation.
    type Topic = { name: string; schemaName: string };
    const { result, rerender } = renderHook<PiAgentOrchestrator | undefined, { topics: Topic[] }>(
      ({ topics }: { topics: Topic[] }) => {
        const topicsRef = useRef(topics);
        useLayoutEffect(() => {
          topicsRef.current = topics;
        });
        const getCatalog = useCallback(
          () => ({ datatypes: new Map(), topics: topicsRef.current }),
          [],
        );
        const dataQuery = useMemo(
          () => ({ getContext: () => ({}) as AgentDataQueryContext }),
          [],
        );
        return useLocalAgentClient(validConfiguration, {
          enabled: true,
          getCatalog,
          dataQuery,
        });
      },
      { initialProps: { topics: [] } },
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toBeDefined();
    const firstClient = result.current;

    // Data source loads: empty catalog → topics appear → more topics arrive.
    rerender({ topics: [{ name: "/imu", schemaName: "sensor_msgs/Imu" }] });
    expect(result.current).toBe(firstClient);
    rerender({
      topics: [
        { name: "/imu", schemaName: "sensor_msgs/Imu" },
        { name: "/gps", schemaName: "sensor_msgs/NavSatFix" },
      ],
    });
    expect(result.current).toBe(firstClient);
  });

  it("does not construct a client for invalid settings", () => {
    const { result } = renderHook(() =>
      useLocalAgentClient(
        { ...validConfiguration, apiKey: "" },
        {
          enabled: true,
          getCatalog: () => ({ datatypes: new Map(), topics: [] }),
        },
      ),
    );

    expect(result.current).toBeUndefined();
  });
});
