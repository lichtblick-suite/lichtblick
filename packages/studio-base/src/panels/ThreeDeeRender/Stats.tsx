// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useState } from "react";
import THREEStats from "three/examples/jsm/libs/stats.module";

import { Renderer } from "./Renderer";
import { useRenderer, useRendererEvent } from "./RendererContext";

let stats: THREEStats | undefined;
let drawCallsPanel: THREEStats.Panel | undefined;
let trianglesPanel: THREEStats.Panel | undefined;
let texturesPanel: THREEStats.Panel | undefined;
let geometriesPanel: THREEStats.Panel | undefined;
let maxDrawCalls = 0;
let maxTriangles = 0;
let maxTextures = 0;
let maxGeometries = 0;

function update(renderer: Renderer) {
  maxDrawCalls = Math.max(maxDrawCalls, renderer.gl.info.render.calls);
  maxTriangles = Math.max(maxTriangles, renderer.gl.info.render.triangles);
  maxTextures = Math.max(maxTextures, renderer.gl.info.memory.textures);
  maxGeometries = Math.max(maxGeometries, renderer.gl.info.memory.geometries);

  drawCallsPanel?.update(renderer.gl.info.render.calls, maxDrawCalls);
  trianglesPanel?.update(renderer.gl.info.render.triangles, maxTriangles);
  texturesPanel?.update(renderer.gl.info.memory.textures, maxTextures);
  geometriesPanel?.update(renderer.gl.info.memory.geometries, maxGeometries);
  stats?.update();
}

export function Stats(): JSX.Element {
  const [div, setDiv] = useState<HTMLDivElement | ReactNull>(ReactNull);
  const renderer = useRenderer();

  useRendererEvent("endFrame", () => renderer && update(renderer));

  useEffect(() => {
    if (!div) {
      return;
    }

    stats = THREEStats();
    stats.dom.style.position = "relative";
    stats.dom.style.zIndex = "auto";
    drawCallsPanel = THREEStats.Panel("draws", "red", "black");
    trianglesPanel = THREEStats.Panel("tris", "cyan", "black");
    texturesPanel = THREEStats.Panel("textures", "yellow", "black");
    geometriesPanel = THREEStats.Panel("geometries", "green", "black");
    stats.addPanel(drawCallsPanel);
    stats.addPanel(trianglesPanel);
    stats.addPanel(texturesPanel);
    stats.addPanel(geometriesPanel);
    div.appendChild(stats.dom);
    stats.showPanel(0);
    return () => stats && void div.removeChild(stats.dom);
  }, [div]);

  return <div ref={setDiv} />;
}
