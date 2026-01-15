// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ErrorInfo } from "react";

import { MessagePathDropConfig } from "@lichtblick/suite-base/components/PanelExtensionAdapter";
import { OpenSiblingPanel, PanelConfig, SaveConfig } from "@lichtblick/suite-base/types/panels";

export type GenericPanelProps<Config> = {
  childId?: string;
  overrideConfig?: Config;
  tabId?: string;
};

export interface PanelStatics<Config> {
  panelType: string;
  defaultConfig: Config;
}

export type SetVisibleLogs = {
  show: boolean;
};

export type PanelContextType<T> = {
  showLogs?: boolean;
  setShowLogs?: (options: SetVisibleLogs) => void;
  logError?: (message: string, error?: Error) => void;
  logCount?: number;
  type: string;
  id: string;
  title: string;
  tabId?: string;

  config: PanelConfig;
  saveConfig: SaveConfig<T>;

  updatePanelConfigs: (panelType: string, updateConfig: (config: T) => T) => void;
  openSiblingPanel: OpenSiblingPanel;
  replacePanel: (panelType: string, config: Record<string, unknown>) => void;

  enterFullscreen: () => void;
  exitFullscreen: () => void;
  isFullscreen: boolean;

  /** Used to adjust z-index settings on parent panels when children are fullscreen */
  // eslint-disable-next-line @lichtblick/no-boolean-parameters
  setHasFullscreenDescendant: (hasFullscreenDescendant: boolean) => void;

  connectToolbarDragHandle?: (el: Element | ReactNull) => void;

  setMessagePathDropConfig: (config: MessagePathDropConfig | undefined) => void;
};

export type PanelErrorBoundaryProps = {
  showErrorDetails?: boolean;
  hideErrorSourceLocations?: boolean;
  onResetPanel: () => void;
  onRemovePanel: () => void;
  onLogError?: (message: string, error?: Error) => void;
};

export type PanelErrorBoundaryState = {
  currentError: { error: Error; errorInfo: ErrorInfo } | undefined;
};

export type PanelLog = { timestamp: string; message: string; error?: Error };

export type PanelLogsProps = {
  logs: PanelLog[];
  onClose: () => void;
  onClear: () => void;
  initialHeight?: number;
  onHeightChange?: (height: number) => void;
};
