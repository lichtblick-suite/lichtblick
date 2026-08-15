// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  useContext,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { v4 as uuidv4 } from "uuid";

import { useDataSourceInfo } from "@lichtblick/suite-base/PanelAPI";
import { AgentCatalogWatcher } from "@lichtblick/suite-base/components/AgentCatalogWatcher";
import {
  useMessagePipelineGetter,
} from "@lichtblick/suite-base/components/MessagePipeline";
import { useAppConfiguration } from "@lichtblick/suite-base/context/AppConfigurationContext";
import CurrentLayoutContext from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useExtensionCatalog } from "@lichtblick/suite-base/context/ExtensionCatalogContext";
import { usePanelCatalog } from "@lichtblick/suite-base/context/PanelCatalogContext";
import AgentChatProvider from "@lichtblick/suite-base/providers/AgentChatProvider";
import {
  selectAgentConfiguration,
  useAgentSettings,
} from "@lichtblick/suite-base/services/agent/agentSettings";
import { useLocalAgentClient } from "@lichtblick/suite-base/services/agent/localAgentClient";
import { AgentConversationStore } from "@lichtblick/suite-base/services/agent/memory/AgentConversationStore";
import {
  createAgentConversationPersistence,
  getOrCreateConversationId,
} from "@lichtblick/suite-base/services/agent/memory/agentConversationPersistence";
import { createAgentMemoryStore } from "@lichtblick/suite-base/services/agent/memory/agentMemory";
import { buildPanelInventory } from "@lichtblick/suite-base/services/agent/panelInventory";
import { readAgentPromptCustomization } from "@lichtblick/suite-base/services/agent/prompts/agentPrompts";
import type { LayoutProposal } from "@lichtblick/suite-base/services/agent/types";
import { useAgentWorkspaceTools } from "@lichtblick/suite-base/services/agent/workspaceTools";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";

type AgentWorkspaceIntegrationProps = {
  agentEnabled: boolean;
  children: React.ReactNode;
};

/**
 * Wires the local-only Agent into the workspace: panel inventory, workspace tools (layout apply,
 * data-source opening, catalog), layout/catalog subscriptions, profile selection, local
 * conversation storage, and the pi orchestrator client, all wrapped in AgentChatProvider.
 */
function ConfiguredAgentWorkspaceIntegration({
  agentEnabled,
  children,
  desktop,
}: AgentWorkspaceIntegrationProps & {
  desktop: boolean;
}): React.JSX.Element {
  const panelCatalog = usePanelCatalog();
  const installedExtensions = useExtensionCatalog((state) => state.installedExtensions);
  const panelInventory = useMemo(
    () => buildPanelInventory(panelCatalog.getPanels(), installedExtensions ?? []),
    [installedExtensions, panelCatalog],
  );
  const panelInventoryRef = useRef(panelInventory);
  useLayoutEffect(() => {
    panelInventoryRef.current = panelInventory;
  }, [panelInventory]);
  const getPanelInventory = useCallback(() => panelInventoryRef.current, []);
  // The trusted live panel-type set (built-in plus extension), read through the same inventory
  // the orchestrator's tool runtime validates proposals against. Re-read on every render so
  // extension installs/uninstalls are reflected in the provider's proposal receive/apply checks.
  const getInstalledPanelTypes = useCallback(
    () => new Set(panelInventoryRef.current.map((panel) => panel.type)),
    [],
  );
  const workspaceTools = useAgentWorkspaceTools();
  const workspaceToolsRef = useRef(workspaceTools);
  useLayoutEffect(() => {
    workspaceToolsRef.current = workspaceTools;
  }, [workspaceTools]);
  const getCatalog = useCallback(() => workspaceToolsRef.current.getCatalog(), []);
  const getCurrentLayout = useCallback(() => workspaceToolsRef.current.getCurrentLayout(), []);
  const getCurrentLayoutId = useCallback(
    () => workspaceToolsRef.current.getCurrentLayoutId(),
    [],
  );
  const getCurrentLayoutState = useCallback(
    () => ({
      id: workspaceToolsRef.current.getCurrentLayoutId(),
      data: workspaceToolsRef.current.getCurrentLayout(),
    }),
    [],
  );
  // Recompute the proposal card mode whenever the layout changes (edit or switch).
  const currentLayoutContext = useContext(CurrentLayoutContext);
  const subscribeToLayoutChanges = useCallback(
    (listener: () => void) => {
      currentLayoutContext?.addLayoutStateListener(listener);
      return () => {
        currentLayoutContext?.removeLayoutStateListener(listener);
      };
    },
    [currentLayoutContext],
  );
  // The proposal card mode also depends on the catalog (sanitized fingerprints): notify listeners
  // whenever the loaded topics/datatypes change so the label matches what applying would decide.
  const { datatypes: catalogDatatypes, topics: catalogTopics } = useDataSourceInfo();
  const catalogChangeListenersRef = useRef(new Set<() => void>());
  useEffect(() => {
    for (const listener of [...catalogChangeListenersRef.current]) {
      listener();
    }
  }, [catalogDatatypes, catalogTopics]);
  const subscribeToCatalogChanges = useCallback((listener: () => void) => {
    catalogChangeListenersRef.current.add(listener);
    return () => {
      catalogChangeListenersRef.current.delete(listener);
    };
  }, []);
  const onApplyProposal = useCallback(async (proposal: LayoutProposal) => {
    await workspaceToolsRef.current.applyLayout(proposal.name, proposal.data, {
      baseLayoutId: proposal.baseLayoutId,
      baseFingerprint: proposal.baseFingerprint,
    });
  }, []);
  const onOpenDataSource = useCallback((urls: string[]) => {
    workspaceToolsRef.current.openDataSource(urls);
  }, []);

  const appConfiguration = useAppConfiguration();
  const { migrationReady, snapshot } = useAgentSettings(appConfiguration, { desktop });
  const [selectedProfileId, setSelectedProfileId] = useState(snapshot.activeProfileId);
  const selectedProfileAvailable = snapshot.profiles.some(
    (profile) => profile.id === selectedProfileId,
  );
  const effectiveSelectedProfileId = selectedProfileAvailable
    ? selectedProfileId
    : snapshot.activeProfileId;
  useEffect(() => {
    if (!selectedProfileAvailable) {
      setSelectedProfileId(snapshot.activeProfileId);
    }
  }, [selectedProfileAvailable, snapshot.activeProfileId]);
  const profileOptions = useMemo(
    () =>
      snapshot.profiles.map((profile) => ({
        id: profile.id,
        name: profile.name,
        isActive: profile.id === snapshot.activeProfileId,
      })),
    [snapshot.activeProfileId, snapshot.profiles],
  );
  const selectedProfileName = profileOptions.find(
    (profile) => profile.id === effectiveSelectedProfileId,
  )?.name;
  const configuration = selectAgentConfiguration(snapshot, {
    desktop,
    profileId: effectiveSelectedProfileId,
  });
  const memoryStore = useMemo(
    () => createAgentMemoryStore(appConfiguration, { makeId: () => uuidv4().slice(0, 8) }),
    [appConfiguration],
  );
  const persistence = useMemo(() => {
    const store = new AgentConversationStore();
    return createAgentConversationPersistence({
      conversationId: getOrCreateConversationId(() => uuidv4()),
      makeId: () => uuidv4(),
      store,
    });
  }, []);
  const getPromptCustomization = useCallback(
    () => readAgentPromptCustomization(appConfiguration),
    [appConfiguration],
  );
  const restoreHistory = useMemo(() => persistence.restorePiLlmHistory, [persistence]);
  const onHistoryChanged = useMemo(() => persistence.onPiLlmHistoryChanged, [persistence]);
  // Data-query tools read the loaded player state through the message pipeline getter, which is
  // re-read on every tool call so capability gating and the active time range stay current. The
  // adapter object is memoized so the local agent client is not rebuilt on every render.
  const dataQueryGetter = useMessagePipelineGetter();
  const dataQuery = useMemo(() => ({ getContext: dataQueryGetter }), [dataQueryGetter]);
  const agentClient = useLocalAgentClient(configuration, {
    dataQuery,
    enabled: agentEnabled && migrationReady && !snapshot.storageError,
    getCatalog,
    getCurrentLayout,
    getCurrentLayoutId,
    getPanelInventory,
    memoryStore,
    onHistoryChanged,
    profileId: effectiveSelectedProfileId,
    restoreHistory,
    getPromptCustomization,
  });
  const configuredAgentEnabled = agentEnabled && agentClient != undefined;

  return (
    <AgentChatProvider
      client={agentClient}
      enabled={configuredAgentEnabled}
      getCatalog={getCatalog}
      getCurrentLayoutState={getCurrentLayoutState}
      getInstalledPanelTypes={getInstalledPanelTypes}
      onApplyProposal={onApplyProposal}
      onOpenDataSource={onOpenDataSource}
      subscribeToCatalogChanges={subscribeToCatalogChanges}
      subscribeToLayoutChanges={subscribeToLayoutChanges}
      onSelectProfile={setSelectedProfileId}
      persistence={persistence}
      profileOptions={profileOptions}
      selectedProfileId={effectiveSelectedProfileId}
      selectedProfileName={selectedProfileName}
    >
      <AgentCatalogWatcher />
      {children}
    </AgentChatProvider>
  );
}

function WebAgentWorkspaceIntegration(props: AgentWorkspaceIntegrationProps): React.JSX.Element {
  return <ConfiguredAgentWorkspaceIntegration {...props} desktop={false} />;
}

export function AgentWorkspaceIntegration(
  props: AgentWorkspaceIntegrationProps,
): React.JSX.Element {
  return isDesktopApp() ? (
    <ConfiguredAgentWorkspaceIntegration {...props} desktop={true} />
  ) : (
    <WebAgentWorkspaceIntegration {...props} />
  );
}
