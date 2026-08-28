// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useSnackbar } from "notistack";
import { useCallback, useMemo } from "react";

import { useDataSourceInfo } from "@lichtblick/suite-base/PanelAPI";
import { useCurrentLayoutActions } from "@lichtblick/suite-base/context/CurrentLayoutContext";
import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";
import { usePanelCatalog } from "@lichtblick/suite-base/context/PanelCatalogContext";
import { usePlayerSelection } from "@lichtblick/suite-base/context/PlayerSelectionContext";
import {
  planIncrementalApply,
  sanitizeLayoutData,
} from "@lichtblick/suite-base/services/agent/layoutDiff";
import { validateLayoutProposalData } from "@lichtblick/suite-base/services/agent/layoutSchema";
import { sanitizePlotPaths } from "@lichtblick/suite-base/services/agent/sanitizePlotPaths";

export type ApplyLayoutOptions = {
  /**
   * Baseline captured at proposal time: the layout id the agent based its proposal on and the
   * stable fingerprint of its data. When both are present, still match, and the proposal is a
   * strict superset of the current layout, the panels are added in place (atomic reducer action,
   * selection unchanged); otherwise the full path (save a new layout and switch) is taken.
   */
  baseLayoutId?: string;
  baseFingerprint?: string;
};

export type AgentWorkspaceTools = {
  openDataSource(urls: string[]): void;
  getCatalog(): {
    topics: readonly unknown[];
    datatypes: ReadonlyMap<string, unknown>;
  };
  applyLayout(name: string, data: unknown, options?: ApplyLayoutOptions): Promise<void>;
  getCurrentLayout(): unknown;
  getCurrentLayoutId(): string | undefined;
};

export function useAgentWorkspaceTools(): AgentWorkspaceTools {
  const { selectSource } = usePlayerSelection();
  const layoutManager = useLayoutManager();
  const { addPanelsAtomically, getCurrentLayoutState, setSelectedLayoutId } =
    useCurrentLayoutActions();
  const { datatypes, topics } = useDataSourceInfo();
  const { enqueueSnackbar } = useSnackbar();
  const panelCatalog = usePanelCatalog();
  // The trusted live panel-type set, re-read from PanelCatalog on every render so extension
  // installs/uninstalls are reflected in the proposal apply validation below (the same source
  // the orchestrator's tool runtime validates against).
  const installedPanelTypes = useMemo(
    () => new Set(panelCatalog.getPanels().map((panel) => panel.type)),
    [panelCatalog],
  );

  const openDataSource = useCallback(
    (urls: string[]) => {
      if (urls.length === 0) {
        throw new Error("Agent data source must include at least one URL");
      }
      if (urls.some((url) => url.includes(","))) {
        throw new Error(
          "Agent data source URLs must not contain literal commas; encode commas as %2C",
        );
      }

      // PlayerSelection's public API returns void. It validates these synchronous arguments, but
      // remote player initialization failures are reported later by PlayerManager. Agent Chat must
      // therefore rely on AgentCatalogWatcher to surface a catalog-load timeout.
      selectSource("remote-file", {
        type: "connection",
        params: { url: urls.join(",") },
      });
    },
    [selectSource],
  );

  const getCatalog = useCallback(() => {
    // Reserved for protocol-v1 catalog reporting after the backend accepts the catalog payload.
    return { topics, datatypes };
  }, [datatypes, topics]);

  const applyLayout = useCallback(
    async (name: string, data: unknown, options?: ApplyLayoutOptions) => {
      const validatedData = validateLayoutProposalData(data, {
        installedPanelTypes,
      });
      // 结构校验后、保存前，按已加载数据过滤 Plot paths（topic/字段链/终止类型存在性）。
      // 数据源未加载或结构构建异常时不过滤；丢弃时向用户给出摘要提示。
      const { data: sanitizedData, droppedCount } = sanitizePlotPaths(
        validatedData,
        topics,
        datatypes,
      );
      if (droppedCount > 0) {
        enqueueSnackbar(`已忽略 ${droppedCount} 条无效曲线`, { variant: "info" });
      }

      // Fast path: the proposal is a strict superset of the layout it was based on and that
      // layout is still selected unchanged. Add the panels atomically in place; the selection
      // id stays, the edit flows through the normal debounced save (N2 auto cloud-save included).
      // Any mismatch falls back to the full path below. Fallback semantics for a mis-apply is
      // the whole-layout Revert; there is no fine-grained undo.
      const current = getCurrentLayoutState().selectedLayout;
      const plan = planIncrementalApply({
        baseLayoutId: options?.baseLayoutId,
        baseFingerprint: options?.baseFingerprint,
        currentLayoutId: current?.id,
        // The current layout goes through the same validate+sanitize pipeline as the proposal,
        // so a base layout with stale Plot paths compares equal to the sanitized proposal.
        currentLayoutData:
          current?.data == undefined
            ? undefined
            : sanitizeLayoutData(current.data, { topics, datatypes }),
        proposalData: sanitizedData,
      });
      if (plan != undefined) {
        addPanelsAtomically({ layout: plan.layout, configs: plan.newPanelConfigs });
        return;
      }

      const layout = await layoutManager.saveNewLayout({
        name,
        data: sanitizedData,
        permission: "CREATOR_WRITE",
      });

      // The public CurrentLayoutContext contract returns void: selection/loading continues
      // asynchronously and reports its own errors. Only saveNewLayout is awaited and can be
      // truthfully reported to Agent Chat as completed here.
      setSelectedLayoutId(layout.id);
    },
    [
      addPanelsAtomically,
      datatypes,
      enqueueSnackbar,
      getCurrentLayoutState,
      installedPanelTypes,
      layoutManager,
      setSelectedLayoutId,
      topics,
    ],
  );

  const getCurrentLayout = useCallback(() => {
    // Reserved for protocol-v1 context/catalog reporting before requesting a replacement layout.
    return getCurrentLayoutState().selectedLayout?.data;
  }, [getCurrentLayoutState]);

  const getCurrentLayoutId = useCallback(() => {
    return getCurrentLayoutState().selectedLayout?.id;
  }, [getCurrentLayoutState]);

  return useMemo(
    () => ({
      openDataSource,
      getCatalog,
      applyLayout,
      getCurrentLayout,
      getCurrentLayoutId,
    }),
    [applyLayout, getCatalog, getCurrentLayout, getCurrentLayoutId, openDataSource],
  );
}
