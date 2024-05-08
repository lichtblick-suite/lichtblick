// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createRoot } from "react-dom/client";

/**
 * Creates a synchronized root for rendering React components.
 *
 * This function is designed to centralize the creation of React roots
 * for rendering components within a given HTML element. It addresses
 * potential race conditions that may occur when mounting and unmounting
 * components synchronously within the React lifecycle.
 *
 * By using a `setTimeout` with a minimal delay of 0 milliseconds, this
 * function ensures that the rendering and unmounting operations occur
 * asynchronously, allowing React to complete its current rendering cycle
 * before proceeding with the next operation. This helps prevent race
 * conditions and warnings related to synchronously unmounting roots.
 *
 * This approach was required since ReactDOM.render() was replaced by createRoot().render.
 *
 * @param component The JSX element to be rendered within the root.
 * @param panelElement The HTML element to serve as the container for the root.
 * @returns A function to unmount the root when needed.
 */
export function createSyncRoot(component: JSX.Element, panelElement: HTMLDivElement): () => void {
  const root = createRoot(panelElement);
  setTimeout(() => {
    root.render(component);
  }, 0);
  return () => {
    setTimeout(() => {
      root.unmount();
    }, 0);
  };
}
