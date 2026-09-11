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
   * toolbar (icons, settings, etc.) is revealed as an overlay when hovering the panel
   * (see `hovered`) or the toolbar area itself.
   */
  floating?: boolean;
  /**
   * When `floating` is true, controls whether the floating controls (icons, settings, etc.)
   * are shown. Pass whether the mouse is anywhere within the panel so the controls appear as
   * soon as the panel is hovered, not only when hovering the small controls area itself.
   */
  hovered?: boolean;
};
