// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useRef } from "react";

import { AtlasData, FontManager } from "./FontManager";

export default {
  title: "FontManager",
};

function atlasToImageData(atlas: AtlasData) {
  const img = new ImageData(atlas.width, atlas.height);
  for (let r = 0; r < atlas.height; r++) {
    for (let c = 0; c < atlas.width; c++) {
      const i = r * atlas.width + c;
      img.data[4 * i + 0] = 255;
      img.data[4 * i + 1] = 255;
      img.data[4 * i + 2] = 255;
      img.data[4 * i + 3] = atlas.data[i]!;
    }
  }
  return img;
}

Atlas.parameters = { colorScheme: "dark" };
export function Atlas(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(ReactNull);
  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    const manager = new FontManager();
    manager.update("Hello world!");
    canvasRef.current.width = manager.atlasData.width;
    canvasRef.current.height = manager.atlasData.height;
    const ctx = canvasRef.current.getContext("2d")!;
    const img = atlasToImageData(manager.atlasData);
    ctx.putImageData(img, 0, 0);
  }, []);

  return <canvas ref={canvasRef} style={{ backgroundColor: "black" }} />;
}

Layout.parameters = { colorScheme: "dark" };
export function Layout(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(ReactNull);
  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    const manager = new FontManager();
    manager.update("Hello world!\nExample");
    const img = atlasToImageData(manager.atlasData);
    const layout = manager.layout("Hello world!\nExample 🤗");

    canvasRef.current.width = layout.width;
    canvasRef.current.height = layout.height;
    const ctx = canvasRef.current.getContext("2d")!;
    for (const char of layout.chars) {
      ctx.putImageData(
        img,
        char.left - char.atlasX,
        char.top - char.atlasY,
        char.atlasX,
        char.atlasY,
        char.width,
        char.height,
      );
    }
  }, []);

  return <canvas ref={canvasRef} style={{ backgroundColor: "black" }} />;
}
