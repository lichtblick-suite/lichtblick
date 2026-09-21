// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { CSSProperties } from "react";

export type PanelToolbarControlsProps = {
  additionalIcons?: React.ReactNode;
  isUnknownPanel: boolean;
};

export type PanelToolbarProps = {
  additionalIcons?: React.ReactNode;
  backgroundColor?: CSSProperties["backgroundColor"];
  children?: React.ReactNode;
  className?: string;
  isUnknownPanel?: boolean;
  /**
   * When true, the toolbar no longer reserves layout space above the panel content.
   * Only the title stays always visible, floating above the content; the rest of the
   * toolbar (icons, settings, etc.) is revealed as an overlay when hovering anywhere within
   * the panel or the toolbar area itself. Visibility is driven entirely by CSS - the panel's
   * root container must carry a `data-panel-root` attribute for the `:hover` bubbling to work
   * (see `PanelExtensionAdapter` and `Plot`).
   */
  floating?: boolean;
};
