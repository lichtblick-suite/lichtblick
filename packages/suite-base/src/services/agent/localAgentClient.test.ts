/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { renderHook, waitFor } from "@testing-library/react";

import { PiAgentOrchestrator } from "@lichtblick/suite-base/services/agent/pi/PiAgentOrchestrator";
import type { AgentDataQueryContext } from "@lichtblick/suite-base/services/agent/tools/toolRuntime";

import { useLocalAgentClient } from "./localAgentClient";

const mockPiAgentOrchestrator = jest.fn();
const mockInstances: Array<{ dispose: jest.Mock }> = [];

jest.mock("@lichtblick/suite-base/services/agent/pi/PiAgentOrchestrator", () => ({
  PiAgentOrchestrator: function OrchestratorMock(...args: unknown[]) {
    const instance = { dispose: jest.fn() };
    mockInstances.push(instance);
    return mockPiAgentOrchestrator(...args) ?? instance;
  },
}));

const getCatalog = jest.fn().mockReturnValue({ topics: [], datatypes: new Map() });

function validConfiguration() {
  return {
    apiKey: "test-key",
    baseUrl: "http://localhost:8080",
    desktop: false,
    model: "test-model",
    provider: "anthropic" as const,
  };
}

type HookProps = {
  apiKey?: string;
  enabled?: boolean;
  profileId?: string;
};

function renderClient(props: HookProps = {}) {
  return renderHook(
    ({ apiKey = "test-key", enabled = true, profileId }: HookProps) =>
      useLocalAgentClient(
        { ...validConfiguration(), apiKey },
        {
          enabled,
          getCatalog,
          profileId,
        },
      ),
    { initialProps: props },
  );
}

describe("useLocalAgentClient data-query wiring", () => {
  beforeEach(() => {
    mockPiAgentOrchestrator.mockClear();
    mockInstances.length = 0;
  });

  it("passes the dataQuery adapter into the orchestrator tool runtime deps", () => {
    const dataQuery = { getContext: jest.fn() };
    renderHook(() =>
      useLocalAgentClient(validConfiguration(), {
        enabled: true,
        getCatalog,
        dataQuery,
      }),
    );

    expect(mockPiAgentOrchestrator).toHaveBeenCalledTimes(1);
    const options = mockPiAgentOrchestrator.mock.calls[0]![0] as {
      toolRuntime: { deps: { dataQuery?: unknown } };
    };
    expect(options.toolRuntime.deps.dataQuery).toBe(dataQuery);
  });

  it("omits dataQuery when the workspace does not provide one", () => {
    renderHook(() =>
      useLocalAgentClient(validConfiguration(), {
        enabled: true,
        getCatalog,
      }),
    );

    const options = mockPiAgentOrchestrator.mock.calls[0]![0] as {
      toolRuntime: { deps: { dataQuery?: unknown } };
    };
    expect(options.toolRuntime.deps.dataQuery).toBeUndefined();
  });
});

describe("useLocalAgentClient client stability (B1)", () => {
  beforeEach(() => {
    mockInstances.length = 0;
  });

  it("releases the client on a real profile switch and rebuilds fresh afterwards", async () => {
    const { result, rerender } = renderClient({ profileId: "p1" });
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
    const first = result.current!;

    // A real profile switch releases the old client (AgentChatProvider sees the undefined
    // transition in the intermediate render and clears the session), then a fresh client is
    // built in the same commit. The observable contract: old client disposed, new client served.
    rerender({ profileId: "p2" });
    expect(result.current).not.toBe(first);
    expect(mockInstances).toHaveLength(2);
    expect(mockInstances[0]!.dispose).toHaveBeenCalled();
    expect(mockInstances[1]!.dispose).not.toHaveBeenCalled();
  });

  it("atomically replaces the client when a non-core dependency changes (no undefined window)", async () => {
    // A changing dataQuery adapter (e.g. a workspace re-render) must never produce an undefined
    // client: that window made AgentChatProvider disable and wipe the conversation.
    const dataQueryRef: { current?: { getContext: () => AgentDataQueryContext } } = {};
    type Props = { dataQuery?: { getContext: () => AgentDataQueryContext } };
    const { result, rerender } = renderHook<PiAgentOrchestrator | undefined, Props>(
      ({ dataQuery }: Props) =>
        useLocalAgentClient(validConfiguration(), {
          enabled: true,
          getCatalog,
          dataQuery,
        }),
      { initialProps: { dataQuery: undefined } },
    );
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
    const first = result.current!;
    dataQueryRef.current = { getContext: () => ({}) as AgentDataQueryContext };

    rerender({ dataQuery: dataQueryRef.current });
    expect(result.current).toBeDefined();
    expect(result.current).not.toBe(first);
  });

  it("atomically replaces the client on a real core configuration change (auth-like fields)", async () => {
    const { result, rerender } = renderClient({ apiKey: "test-key" });
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
    const first = result.current!;

    // Core fields (apiKey/baseUrl/model/provider) are real switches:
    // the old client must be released and the new one exposed.
    rerender({ apiKey: "other-key" });
    await waitFor(() => {
      expect(result.current).toBeDefined();
      expect(result.current).not.toBe(first);
    });
    expect(mockInstances).toHaveLength(2);
    expect(mockInstances[0]!.dispose).toHaveBeenCalled();
  });

  it("returns undefined when the switch is turned off (real disable)", async () => {
    const { result, rerender } = renderClient({ enabled: true });
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    rerender({ enabled: false });
    expect(result.current).toBeUndefined();
    expect(mockInstances[0]!.dispose).toHaveBeenCalled();
  });

  it("does not expose a stale client after a real disable", async () => {
    const { result, rerender } = renderClient({ enabled: true });
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
    const first = result.current!;

    rerender({ enabled: false });
    expect(result.current).toBeUndefined();

    // Re-enabling builds a fresh client, not the disposed one.
    rerender({ enabled: true });
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
    expect(result.current).not.toBe(first);
    expect(mockInstances).toHaveLength(2);
    expect(mockInstances[1]!.dispose).not.toHaveBeenCalled();
  });

  it("releases the client on a real auth/workspace-like switch (empty apiKey)", async () => {
    const { result, rerender } = renderClient({ apiKey: "test-key" });
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });

    // An empty apiKey is an auth-like configuration change: the old client is released so the
    // session can be cleared, and a fresh client is built once the configuration is valid again.
    rerender({ apiKey: "" });
    expect(result.current).toBeUndefined();
    expect(mockInstances[0]!.dispose).toHaveBeenCalled();

    rerender({ apiKey: "test-key" });
    await waitFor(() => {
      expect(result.current).toBeDefined();
    });
    expect(mockInstances).toHaveLength(2);
    expect(mockInstances[1]!.dispose).not.toHaveBeenCalled();
  });
});

void PiAgentOrchestrator;
