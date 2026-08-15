// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";

import Logger from "@lichtblick/log";
import {
  AgentConfiguration,
  isAgentConfigurationValid,
} from "@lichtblick/suite-base/services/agent/agentSettings";
import { summarizeWorkspace } from "@lichtblick/suite-base/services/agent/local/systemPrompt";
import type { CatalogSnapshot } from "@lichtblick/suite-base/services/agent/local/types";
import type { AgentMemoryStore } from "@lichtblick/suite-base/services/agent/memory/agentMemory";
import type { PanelInventoryEntry } from "@lichtblick/suite-base/services/agent/panelInventory";
import {
  PiAgentOrchestrator,
  type PiAgentOrchestratorOptions,
} from "@lichtblick/suite-base/services/agent/pi/PiAgentOrchestrator";
import type { ToolRuntimeDeps } from "@lichtblick/suite-base/services/agent/tools/toolRuntime";

const log = Logger.getLogger(__filename);

const noLayout = (): undefined => undefined;
const noPanels = (): readonly PanelInventoryEntry[] => [];

export type AgentClientConfiguration = AgentConfiguration & {
  getCatalog: () => CatalogSnapshot;
  getCurrentLayout?: () => unknown;
  getCurrentLayoutId?: () => string | undefined;
  getPanelInventory?: () => readonly PanelInventoryEntry[];
  memoryStore?: AgentMemoryStore;
  onHistoryChanged?: PiAgentOrchestratorOptions["onHistoryChanged"];
  restoreHistory?: PiAgentOrchestratorOptions["restoreHistory"];
  getPromptCustomization?: PiAgentOrchestratorOptions["getPromptCustomization"];
  /** Loaded-data reading and playback control for read_messages / search_messages / playback_control. */
  dataQuery?: ToolRuntimeDeps["dataQuery"];
};

function createLocalAgentClient({
  apiKey,
  baseUrl,
  dataQuery,
  desktop,
  getCatalog,
  getCurrentLayout,
  getCurrentLayoutId,
  getPanelInventory,
  getPromptCustomization,
  memoryStore,
  model,
  onHistoryChanged,
  restoreHistory,
  provider,
}: AgentClientConfiguration): PiAgentOrchestrator {
  if (
    !isAgentConfigurationValid({
      apiKey,
      baseUrl,
      desktop,
      model,
      provider,
    })
  ) {
    throw new Error("Cannot create a local Agent client from an invalid configuration");
  }

  const normalizedBaseUrl = baseUrl.trim();
  const normalizedModel = model.trim();

  return new PiAgentOrchestrator({
    configuration: {
      apiKey,
      baseUrl: normalizedBaseUrl,
      desktop,
      model: normalizedModel,
      provider,
    },
    getPromptCustomization,
    getPanelInventory,
    getWorkspaceContext: () => summarizeWorkspace(getCatalog(), getCurrentLayout?.()),
    getCurrentLayout,
    getCurrentLayoutId,
    memoryStore,
    onHistoryChanged,
    restoreHistory,
    toolRuntime: {
      deps: {
        getCatalog,
        memoryStore,
        dataQuery,
      },
    },
  });
}

export function useLocalAgentClient(
  configuration: AgentConfiguration,
  {
    dataQuery,
    enabled,
    getCatalog,
    getCurrentLayout,
    getCurrentLayoutId,
    getPanelInventory,
    getPromptCustomization,
    memoryStore,
    onHistoryChanged,
    profileId,
    restoreHistory,
  }: {
    enabled: boolean;
    getCatalog: AgentClientConfiguration["getCatalog"];
    getCurrentLayout?: () => unknown;
    getCurrentLayoutId?: () => string | undefined;
    getPanelInventory?: () => readonly PanelInventoryEntry[];
    memoryStore?: AgentMemoryStore;
    onHistoryChanged?: PiAgentOrchestratorOptions["onHistoryChanged"];
    profileId?: string;
    restoreHistory?: PiAgentOrchestratorOptions["restoreHistory"];
    getPromptCustomization?: PiAgentOrchestratorOptions["getPromptCustomization"];
    dataQuery?: AgentClientConfiguration["dataQuery"];
  },
): PiAgentOrchestrator | undefined {
  const { apiKey, baseUrl, desktop, model, provider } =
    configuration;
  const stableGetCatalog = useLatestAgentCatalog(getCatalog);
  const stableGetCurrentLayout = useLatestGetter(getCurrentLayout ?? noLayout);
  const stableGetCurrentLayoutId = useLatestGetter(getCurrentLayoutId ?? noLayout);
  const stableGetPanelInventory = useLatestGetter(getPanelInventory ?? noPanels);
  // The identity is a pure render value. Resource creation is deferred until a committed layout
  // effect, so an abandoned concurrent render cannot leak an orchestrator.
  const configurationIdentity = useMemo(
    () => ({
      apiKey,
      baseUrl,
      desktop,
      enabled,
      model,
      profileId,
      provider,
    }),
    [apiKey, baseUrl, desktop, enabled, model, profileId, provider],
  );
  const valid =
    configurationIdentity.enabled &&
    isAgentConfigurationValid(configurationIdentity);
  // Core configuration: these fields count as a real switch (workspace/auth/profile-like) and
  // releasing the client clears the conversation, which is the desired behavior for those
  // transitions. Transient validity flickers of the SAME core fields (or unrelated re-renders)
  // must NOT release the client — releasing would make AgentChatProvider wipe the conversation.
  const coreKey = useMemo(
    () =>
      [apiKey, baseUrl, desktop, model, profileId, provider].join(
        "\u0000",
      ),
    [apiKey, baseUrl, desktop, model, profileId, provider],
  );
  const [resource, setResource] = useState<{
    client: PiAgentOrchestrator;
    coreKey: string;
    identity: object;
  }>();
  // resourceRef is maintained manually by the build/release effects (and cleared on unmount);
  // a render-sync effect would clobber it during StrictMode's double effect setup.
  const resourceRef = useRef(resource);

  const coreChanged = resource != undefined && resource.coreKey !== coreKey;
  const shouldRelease = !configurationIdentity.enabled || coreChanged;
  // Real release: the switch is off or a core configuration field changed. Runs BEFORE the build
  // effect so the old resource is disposed and dropped first; the build effect (if the new
  // configuration is valid) then publishes the replacement in the same commit. Consumers observe
  // one undefined transition (AgentChatProvider clears the session) followed by the new client.
  useLayoutEffect(() => {
    if (!shouldRelease) {
      return;
    }
    const current = resourceRef.current;
    if (current == undefined) {
      return;
    }
    resourceRef.current = undefined;
    setResource(undefined);
    try {
      current.client.dispose();
    } catch (error) {
      log.error(error, "Failed to dispose local Agent orchestrator");
    }
  }, [shouldRelease]);

  useLayoutEffect(() => {
    if (!valid) {
      return undefined;
    }
    const current = configurationIdentity;
    const client = createLocalAgentClient({
      apiKey: current.apiKey,
      baseUrl: current.baseUrl,
      dataQuery,
      desktop: current.desktop,
      getCatalog: stableGetCatalog,
      getCurrentLayout: stableGetCurrentLayout,
      getCurrentLayoutId: stableGetCurrentLayoutId,
      getPanelInventory: stableGetPanelInventory,
      getPromptCustomization,
      memoryStore,
      model: current.model,
      onHistoryChanged,
      restoreHistory,
      provider: current.provider,
    });
    // Atomic replacement: the new client is published in this commit; the previous one (if any)
    // is disposed one commit later. A transient identity/validity flicker therefore never leaves
    // consumers without a client.
    const previous = resourceRef.current;
    const next = { client, coreKey, identity: configurationIdentity };
    resourceRef.current = next;
    setResource(next);
    // Dispose the replaced client on a microtask, after React's synchronous effect cycle (and
    // after any cleanup microtasks of this commit): consumers are already observing the new
    // client by then, and StrictMode's double-mount completes without a follow-up render that a
    // state-driven disposal would need.
    if (previous != undefined && previous.client !== client) {
      queueMicrotask(() => {
        if (resourceRef.current?.client === client) {
          try {
            previous.client.dispose();
          } catch (error) {
            log.error(error, "Failed to dispose local Agent orchestrator");
          }
        }
      });
    }
    return () => {
      // Unmount or StrictMode's simulated unmount: dispose the client unless a rebuild in the
      // same commit already replaced it (the microtask runs after React's synchronous effect
      // cycle, so a replaced ref means the component is still mounted and the replacement owns
      // the lifecycle).
      queueMicrotask(() => {
        if (resourceRef.current?.client === client) {
          resourceRef.current = undefined;
          try {
            client.dispose();
          } catch (error) {
            log.error(error, "Failed to dispose local Agent orchestrator");
          }
        }
      });
    };
  }, [
    configurationIdentity,
    coreKey,
    getPromptCustomization,
    memoryStore,
    onHistoryChanged,
    restoreHistory,
    stableGetCatalog,
    dataQuery,
    stableGetCurrentLayout,
    stableGetCurrentLayoutId,
    stableGetPanelInventory,
    valid,
  ]);

  // Rebuild/validity flickers keep serving the last successfully built client; only a real
  // disable or a core configuration switch releases it.
  return shouldRelease ? undefined : resource?.client;
}

/**
 * Wraps a getter in a stable identity so it can be handed to the orchestrator without a changing
 * reference forcing the client to be rebuilt on every render.
 */
function useLatestGetter<T>(getter: () => T): () => T {
  const latestRef = useRef(getter);
  useLayoutEffect(() => {
    latestRef.current = getter;
  }, [getter]);
  return useCallback(() => latestRef.current(), []);
}

function useLatestAgentCatalog(
  getCatalog: AgentClientConfiguration["getCatalog"],
): AgentClientConfiguration["getCatalog"] {
  return useLatestGetter(getCatalog);
}
