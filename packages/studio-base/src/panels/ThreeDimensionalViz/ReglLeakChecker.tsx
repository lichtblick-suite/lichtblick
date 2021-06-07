// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { WorldviewReactContext, WorldviewContextType } from "regl-worldview";

const { useContext, useRef, useState } = React;

const MAX_RENDER_COUNT = 5;
const style: React.CSSProperties = {
  backgroundColor: "red",
  position: "absolute",
  top: 0,
  left: 0,
  fontSize: 20,
};
const keysToCheck = [
  "bufferCount",
  "elementsCount",
  "shaderCount",
  "textureCount",
  "framebufferCount",
];
// Wrap a *static* regl rendered scene with this & it will compare stat changes across 5 renders.
// If any stats change it will output a red error box instead of the child regl components.
// Do not use in a scene that changes a lot or has external animation frames as this is only meant to render once.
// If the components within this are having their props updated externally its probably not going to work correctly.
export default function ReglLeakChecker({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  const context = useContext<WorldviewContextType>(WorldviewReactContext);
  const [renderCount, setRenderCount] = useState<number>(1);
  const originalStats = useRef<Record<string, number> | undefined>(undefined);
  if (renderCount < MAX_RENDER_COUNT) {
    requestAnimationFrame(() => setRenderCount((count) => count + 1));
  }
  // the first two renders w/ regl initialized should initialize buffers & textures
  if (context.initializedData && renderCount > 2) {
    const stats = Object.keys(context.initializedData.regl.stats).reduce((prev, key) => {
      if (keysToCheck.includes(key)) {
        prev[key] = context.initializedData.regl.stats[key];
      }
      return prev;
    }, {} as Record<string, number>);
    // save a snapshot of the first "initialized" render pass stats
    originalStats.current = originalStats.current ?? stats;
    if (renderCount >= MAX_RENDER_COUNT) {
      for (const key in originalStats.current) {
        const originalValue = originalStats.current[key];
        const newValue = stats[key];
        if (newValue !== originalValue) {
          const msg = `Detected regl stat drift in stat "${key}": ${originalValue} -> ${newValue}.  This might indicate a memory leak.`;
          context.onDirty();
          return <div style={style}>{msg}</div>;
        }
      }
    }
  }
  return children;
}
