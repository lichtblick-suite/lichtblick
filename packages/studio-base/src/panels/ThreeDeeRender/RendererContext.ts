// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";
import { createContext, useContext, useEffect, useState } from "react";

import type { IRenderer, RendererEvents } from "./IRenderer";

export const RendererContext = createContext<IRenderer | undefined>(undefined);

/**
 * React hook to retrieve the Renderer instance registered with the
 * RendererContext. This will always return undefined from the ThreeDeeRender()
 * component since the context exists below ThreeDeeRender().
 */
export function useRenderer(): IRenderer | undefined {
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
  listener: (
    ...args: EventEmitter.ArgumentMap<RendererEvents>[Extract<K, keyof RendererEvents>]
  ) => void,
  rendererInstance?: IRenderer | ReactNull,
): void {
  const usedRenderer = useRenderer();
  const renderer = rendererInstance ?? usedRenderer;

  useEffect(() => {
    renderer?.addListener(eventName, listener);
    return () => void renderer?.removeListener(eventName, listener);
  }, [listener, eventName, renderer]);
}

/**
 * Returns a property from the Renderer instance. Updates when the event is called
 *
 * @param key - Property key to subscribe to
 * @param event - Event name that should trigger a re-render to read the property again
 * @param fallback - Fallback value to use if the property is not available or undefined
 * @param rendererInstance - Optional Renderer instance to subscribe to instead of the reference returned by useRenderer()
 * @returns - value of renderer property or fallback if undefined
 */
export function useRendererProperty<K extends keyof IRenderer>(
  key: K,
  event: keyof RendererEvents,
  fallback: () => IRenderer[K],
  rendererInstance?: IRenderer | undefined,
): IRenderer[K] {
  const usedRenderer = useRenderer();
  const renderer = rendererInstance ?? usedRenderer;

  const [value, setValue] = useState<IRenderer[K]>(() => renderer?.[key] ?? fallback());
  useEffect(() => {
    if (!renderer) {
      return;
    }
    const onChange = () => {
      setValue(() => renderer[key]);
    };
    onChange();

    renderer.addListener(event, onChange);
    return () => {
      renderer.removeListener(event, onChange);
    };
  }, [renderer, event, key]);
  return value;
}
