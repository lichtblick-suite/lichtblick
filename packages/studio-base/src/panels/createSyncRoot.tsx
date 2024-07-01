// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ReactDOM from "react-dom";

/**
 * Creates a root for rendering React components.
 *
 * This function is designed to centralize the creation of React roots
 * for rendering components within a given HTML element.
 *
 * This approach should be replaced by createRoot().render, but it create issues on the application.
 * In the future this has to solved.
 *
 * @param component The JSX element to be rendered within the root.
 * @param panelElement The HTML element to serve as the container for the root.
 * @returns A function to unmount the root when needed.
 */
export function createSyncRoot(component: JSX.Element, panelElement: HTMLDivElement): () => void {
  // eslint-disable-next-line react/no-deprecated
  ReactDOM.render(component, panelElement);
  return () => {
    // eslint-disable-next-line react/no-deprecated
    ReactDOM.unmountComponentAtNode(panelElement);
  };
}
