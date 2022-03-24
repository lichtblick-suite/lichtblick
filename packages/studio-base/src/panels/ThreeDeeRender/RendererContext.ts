// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ArgumentMap } from "eventemitter3";
import { createContext, useContext, useEffect } from "react";

import { Renderer, RendererEvents } from "./Renderer";

export const RendererContext = createContext<Renderer | ReactNull>(ReactNull);

export function useRenderer(): Renderer | undefined {
  const renderer = useContext(RendererContext);
  return renderer ?? undefined;
}

export function useRendererEvent<K extends keyof RendererEvents>(
  eventName: K,
  listener: (...args: ArgumentMap<RendererEvents>[Extract<K, keyof RendererEvents>]) => void,
): void {
  const renderer = useRenderer();

  useEffect(() => {
    renderer?.addListener(eventName, listener);
    return () => void renderer?.removeListener(eventName, listener);
  }, [listener, eventName, renderer]);
}
