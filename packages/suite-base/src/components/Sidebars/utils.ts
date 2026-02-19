// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MosaicNode } from "react-mosaic-component";

import { LEFT_SIDEBAR_MIN_WIDTH_PX } from "@lichtblick/suite-base/components/Sidebars/constants";
import { LayoutNode } from "@lichtblick/suite-base/components/Sidebars/types";

/**
 * Clamp a given percentage to the minimum width of the left sidebar.
 */
export function clampLeftSidebarPercentage(percentage: number): number {
  const minPercentage = (LEFT_SIDEBAR_MIN_WIDTH_PX / window.innerWidth) * 100;
  return Math.max(percentage, minPercentage);
}

/**
 * Extract existing left split percentage from a layout node or return the default.
 */
export function mosaicLeftSidebarSplitPercentage(node: MosaicNode<LayoutNode>): number | undefined {
  if (typeof node !== "object") {
    return undefined;
  }
  if (node.first === "leftbar") {
    return node.splitPercentage;
  } else {
    return (
      mosaicLeftSidebarSplitPercentage(node.first) ?? mosaicLeftSidebarSplitPercentage(node.second)
    );
  }
}

/**
 * Extract existing right split percentage from a layout node or return the default.
 */
export function mosaicRightSidebarSplitPercentage(
  node: MosaicNode<LayoutNode>,
): number | undefined {
  if (typeof node !== "object") {
    return undefined;
  }
  if (node.second === "rightbar") {
    return node.splitPercentage;
  } else {
    return (
      mosaicRightSidebarSplitPercentage(node.first) ??
      mosaicRightSidebarSplitPercentage(node.second)
    );
  }
}
