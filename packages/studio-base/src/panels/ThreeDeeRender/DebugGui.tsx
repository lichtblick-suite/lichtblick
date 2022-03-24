// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { GUI } from "dat.gui";
import { useEffect, useState } from "react";

import { Renderer } from "./Renderer";
import { useRenderer } from "./RendererContext";

export function DebugGui(): JSX.Element {
  const [div, setDiv] = useState<HTMLDivElement | ReactNull>(ReactNull);
  const renderer = useRenderer();

  useEffect(() => {
    if (!renderer || !div) {
      return;
    }

    const gui = createDebugGui(renderer, div);
    return () => void div.removeChild(gui.domElement);
  }, [div, renderer]);

  return <div ref={setDiv} />;
}

function createDebugGui(renderer: Renderer, div: HTMLDivElement): GUI {
  const gui = new GUI({ autoPlace: false, width: 300 });
  div.appendChild(gui.domElement);

  const rendererFolder = gui.addFolder("Renderer");
  rendererFolder.add(renderer.gl, "toneMappingExposure", 0, 2, 0.01);
  rendererFolder.add(renderer.gl, "physicallyCorrectLights", false);

  return gui;
}
