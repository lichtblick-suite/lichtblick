// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ArgumentMap } from "eventemitter3";
import { createContext, useContext, useEffect } from "react";

import { Renderer, RendererEvents } from "./Renderer";

export const RendererContext = createContext<Renderer | undefined>(undefined);

/**
 * React hook to retrieve the Renderer instance registered with the
 * RendererContext. This will always return undefined from the ThreeDeeRender()
 * component since the context exists below ThreeDeeRender().
 */
export function useRenderer(): Renderer | undefined {
  const renderer = useContext(RendererContext);
  return renderer ?? undefined;
}

/**
 * React hook that subscribes to Renderer events. The optional
 * `rendererInstance` argument must be passed when calling from the
 * ThreeDeeRender() component which is above the RendererContext.
 * @param eventName Event name to subscribe to
 * @param listener Event callback
 * @param rendererInstance Optional Renderer instance to subscribe to instead of
 *   the reference returned by useRenderer()
 */
export function useRendererEvent<K extends keyof RendererEvents>(
  eventName: K,
  listener: (...args: ArgumentMap<RendererEvents>[Extract<K, keyof RendererEvents>]) => void,
  rendererInstance?: Renderer | ReactNull,
): void {
  const usedRenderer = useRenderer();
  const renderer = rendererInstance ?? usedRenderer;

  useEffect(() => {
    renderer?.addListener(eventName, listener);
    return () => void renderer?.removeListener(eventName, listener);
  }, [listener, eventName, renderer]);
}
