// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createRoot, Root } from "react-dom/client";

/**
 * Creates a root for rendering React components.
 *
 * This function is designed to centralize the creation of React roots
 * for rendering components within a given HTML element.
 *
 * @param component The JSX element to be rendered within the root.
 * @param panelElement The HTML element to serve as the container for the root.
 * @returns A function to unmount the root when needed.
 */
export function createSyncRoot(
  component: React.JSX.Element,
  panelElement: HTMLDivElement,
): () => void {
  const root: Root = createRoot(panelElement);
  root.render(component);
  return () => {
    // Use queueMicrotask to ensure that the unmount occurs after the render cycle
    queueMicrotask(() => {
      root.unmount();
      panelElement.remove();
    });
  };
}
