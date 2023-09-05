// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useState } from "react";

import type { IRenderer } from "./IRenderer";
import { useRendererEvent } from "./RendererContext";

let stats: THREEStats | undefined;
let drawCallsPanel: Panel | undefined;
let trianglesPanel: Panel | undefined;
let texturesPanel: Panel | undefined;
let geometriesPanel: Panel | undefined;
let maxDrawCalls = 0;
let maxTriangles = 0;
let maxTextures = 0;
let maxGeometries = 0;

function update(renderer: IRenderer) {
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

  useRendererEvent("endFrame", (_curTime, curRenderer) => {
    update(curRenderer);
  });

  useEffect(() => {
    if (!div) {
      return;
    }

    stats = new THREEStats();
    stats.dom.style.position = "relative";
    stats.dom.style.zIndex = "auto";
    drawCallsPanel = new Panel("draws", "red", "black");
    trianglesPanel = new Panel("tris", "cyan", "black");
    texturesPanel = new Panel("textures", "yellow", "black");
    geometriesPanel = new Panel("geometries", "green", "black");
    stats.addPanel(drawCallsPanel);
    stats.addPanel(trianglesPanel);
    stats.addPanel(texturesPanel);
    stats.addPanel(geometriesPanel);
    div.appendChild(stats.dom);
    stats.showPanel(0);
    return () => {
      if (stats) {
        try {
          div.removeChild(stats.dom);
        } catch (ex) {
          // ignore
        }
      }
    };
  }, [div]);

  return <div ref={setDiv} />;
}

// Adapted from <https://github.com/mrdoob/stats.js/>. The frame time panel is
// modified to use a maximum value of ~33ms instead of the default 200ms and
// the FPS panel is removed
class THREEStats {
  #mode = 0;
  #container: HTMLDivElement;
  public dom: HTMLDivElement;
  #beginTime: number;
  #prevTime: number;
  #msPanel: Panel;
  // fpsPanel: Panel;
  #memPanel: Panel;

  public constructor() {
    this.#container = document.createElement("div");
    this.#container.style.cssText =
      "position:fixed;top:0;left:0;cursor:pointer;opacity:0.9;z-index:10000";
    this.#container.addEventListener(
      "click",
      (event) => {
        event.preventDefault();
        this.showPanel(++this.#mode % this.#container.children.length);
      },
      false,
    );
    this.dom = this.#container;

    this.#beginTime = performance.now();
    this.#prevTime = this.#beginTime;

    this.#msPanel = this.addPanel(new Panel("MS", "#9480ed", "#1e1a2f"));
    // this.fpsPanel = this.addPanel(new Panel("FPS", "#0ff", "#002"));
    this.#memPanel = this.addPanel(new Panel("MB", "#f08", "#201"));

    this.showPanel(0);
  }

  public addPanel(panel: Panel) {
    this.#container.appendChild(panel.dom);
    return panel;
  }

  public showPanel(id: number) {
    for (let i = 0; i < this.#container.children.length; i++) {
      const child = this.#container.children[i] as HTMLElement;
      child.style.display = i === id ? "block" : "none";
    }

    this.#mode = id;
  }

  public begin = () => {
    this.#beginTime = performance.now();
  };

  public end = () => {
    const time = performance.now();

    this.#msPanel.update(time - this.#beginTime, 1000 / 30);

    if (time >= this.#prevTime + 1000) {
      // this.fpsPanel.update((this.frames * 1000) / (time - this.prevTime), 100);

      this.#prevTime = time;

      const memory = (
        performance as unknown as { memory: { usedJSHeapSize: number; jsHeapSizeLimit: number } }
      ).memory;
      this.#memPanel.update(memory.usedJSHeapSize / 1048576, memory.jsHeapSizeLimit / 1048576);
    }

    return time;
  };

  public update = () => {
    this.#beginTime = this.end();
  };
}

// Adapted from <https://github.com/mrdoob/stats.js/>. License: MIT.
class Panel {
  public dom: HTMLCanvasElement;
  #context: CanvasRenderingContext2D;
  #min = Infinity;
  #max = 0;
  #name: string;
  #fg: string;
  #bg: string;

  public constructor(name: string, fg: string, bg: string) {
    this.#name = name;
    this.#fg = fg;
    this.#bg = bg;

    const PR = Math.round(window.devicePixelRatio);
    const WIDTH = 80 * PR,
      HEIGHT = 48 * PR,
      TEXT_X = 3 * PR,
      TEXT_Y = 2 * PR,
      GRAPH_X = 3 * PR,
      GRAPH_Y = 15 * PR,
      GRAPH_WIDTH = 74 * PR,
      GRAPH_HEIGHT = 30 * PR;

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    canvas.style.cssText = "width:80px;height:48px";

    const context = canvas.getContext("2d")!;
    context.font = `bold ${9 * PR}px Helvetica,Arial,sans-serif`;
    context.textBaseline = "top";

    context.fillStyle = bg;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    context.fillStyle = fg;
    context.fillText(name, TEXT_X, TEXT_Y);
    context.fillRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);

    context.fillStyle = bg;
    context.globalAlpha = 0.9;
    context.fillRect(GRAPH_X, GRAPH_Y, GRAPH_WIDTH, GRAPH_HEIGHT);

    this.dom = canvas;
    this.#context = context;
  }

  public update(value: number, maxValue: number): void {
    const PR = Math.round(window.devicePixelRatio);
    const WIDTH = 80 * PR,
      TEXT_X = 3 * PR,
      TEXT_Y = 2 * PR,
      GRAPH_X = 3 * PR,
      GRAPH_Y = 15 * PR,
      GRAPH_WIDTH = 74 * PR,
      GRAPH_HEIGHT = 30 * PR;

    this.#min = Math.min(this.#min, value);
    this.#max = Math.max(this.#max, value);

    this.#context.fillStyle = this.#bg;
    this.#context.globalAlpha = 1;
    this.#context.fillRect(0, 0, WIDTH, GRAPH_Y);
    this.#context.fillStyle = this.#fg;
    this.#context.fillText(
      `${Math.round(value)} ${this.#name} (${Math.round(this.#min)}-${Math.round(this.#max)})`,
      TEXT_X,
      TEXT_Y,
    );

    this.#context.drawImage(
      this.dom,
      GRAPH_X + PR,
      GRAPH_Y,
      GRAPH_WIDTH - PR,
      GRAPH_HEIGHT,
      GRAPH_X,
      GRAPH_Y,
      GRAPH_WIDTH - PR,
      GRAPH_HEIGHT,
    );

    this.#context.fillRect(GRAPH_X + GRAPH_WIDTH - PR, GRAPH_Y, PR, GRAPH_HEIGHT);

    this.#context.fillStyle = this.#bg;
    this.#context.globalAlpha = 0.9;
    this.#context.fillRect(
      GRAPH_X + GRAPH_WIDTH - PR,
      GRAPH_Y,
      PR,
      Math.round((1 - value / maxValue) * GRAPH_HEIGHT),
    );
  }
}
