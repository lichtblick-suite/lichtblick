// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import textMetrics from "text-metrics";
import * as THREE from "three";

import Logger from "@foxglove/log";
import { DEFAULT_LABEL_PPU } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/CoreSettings";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import { Renderer } from "./Renderer";
import { makeRgba, rgbaToCssString, stringToRgba, rgbaToLinear } from "./color";
import { DetailLevel } from "./lod";
import { ColorRGBA } from "./ros";
import { makePose, Pose } from "./transforms";

const log = Logger.getLogger(__filename);
void log;

const LIGHT_COLOR_STR = "#27272b";
const LIGHT_BACKGROUND_COLOR_STR = "#ececec";
const DARK_COLOR_STR = "#e1e1e4";
const DARK_BACKGROUND_COLOR_STR = "#181818";

const LIGHT_COLOR = stringToRgba(makeRgba(), LIGHT_COLOR_STR);
const LIGHT_BACKGROUND_COLOR = stringToRgba(makeRgba(), LIGHT_BACKGROUND_COLOR_STR);
const DARK_COLOR = stringToRgba(makeRgba(), DARK_COLOR_STR);
const DARK_BACKGROUND_COLOR = stringToRgba(makeRgba(), DARK_BACKGROUND_COLOR_STR);

export type LabelOptions = {
  /** Text string of the label. */
  text: string;
  /** Text color. Defaults to a theme-derived color. */
  color?: ColorRGBA;
  /** Font size in pixels. Defaults to 14. */
  fontSize?: number;
  /** Color to fill in the label inside the border behind the text. Defaults to
   * a theme-derived color. */
  backgroundColor?: ColorRGBA;
  /** Padding between the border and text in pixels, or edge of the label and
   * text if there is no border. Default is 0. */
  padding?: number;
  /** Width of the text outline in pixels. Default is 0. */
  outlineWidth?: number;
  /** Color to draw the text outline in. Defaults to a theme-derived color, but
   * has no effect if outlineWidth is 0. */
  outlineColor?: ColorRGBA;
  /** Rounds the corners of the outer border if set to a non-zero number of
   * pixels. Default is 0. */
  borderRadius?: number;
  /** Width of the border in pixels. Default is 0. */
  borderWidth?: number;
  /** Color to draw the border in. Defaults to a theme-derived color, but has
   * no effect if borderWidth is 0. */
  borderColor?: ColorRGBA;
  /** Degrees to rotate the label in clockwise direction on the screen. */
  rotationDegrees?: number;
  /** Controls the size of the label by setting the pixel density per unit of
   * world space (usually meters). Default is 100. */
  pixelsPerUnit?: number;
};

export type LabelRenderable = Omit<THREE.Sprite, "userData"> & {
  userData: {
    id: string;
    label: LabelOptions;
    pose: Pose;
    width: number;
    height: number;
  };
};

/**
 * Manages creation and rendering of canvas-based billboard labels in the 3D scene.
 */
export class Labels extends THREE.Object3D {
  renderer: Renderer;
  sprites = new Map<string, LabelRenderable>();

  constructor(renderer: Renderer) {
    super();
    this.renderer = renderer;
  }

  setLabel(id: string, label: LabelOptions): LabelRenderable {
    const extraScale = scaleFactor(this.renderer.maxLod);
    const scale = window.devicePixelRatio + extraScale;
    const canvas = this.createCanvas(label, extraScale);
    const texture = new THREE.CanvasTexture(canvas);
    const width = canvas.width / scale;
    const height = canvas.height / scale;

    let sprite = this.sprites.get(id);
    if (!sprite) {
      sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          name: `label:${id}`,
          map: texture,
          dithering: true,
          transparent: true,
          sizeAttenuation: true,
        }),
      ) as LabelRenderable;
      sprite.userData = { id, label, pose: makePose(), width, height };
      this.sprites.set(id, sprite);
    } else {
      sprite.material.map = texture;
      sprite.material.needsUpdate = true;
      sprite.userData.label = label;
      sprite.userData.width = width;
      sprite.userData.height = height;
    }

    const pixelsPerUnit =
      label.pixelsPerUnit ?? this.renderer.config.scene.labelPixelsPerUnit ?? DEFAULT_LABEL_PPU;
    sprite.scale.set(width / pixelsPerUnit, height / pixelsPerUnit, 1);

    return sprite;
  }

  removeById(id: string): boolean {
    const sprite = this.sprites.get(id);
    if (sprite) {
      this.remove(sprite);
      sprite.material.map?.dispose();
      sprite.material.dispose();
      this.sprites.delete(id);
      return true;
    }
    return false;
  }

  setColorScheme(colorScheme: "light" | "dark", _sceneBgColor: THREE.Color | undefined): void {
    if (this.renderer.colorScheme !== colorScheme) {
      throw new Error(`Labels#setColorScheme() called before setting Renderer#colorScheme`);
    }

    // Redraw all of the labels to use the new color scheme
    for (const [id, sprite] of this.sprites.entries()) {
      this.setLabel(id, sprite.userData.label);
    }
  }

  setPixelsPerUnit(pixelsPerUnit: number): void {
    // Resize all of the labels using the new PPU
    for (const sprite of this.sprites.values()) {
      sprite.userData.label.pixelsPerUnit = pixelsPerUnit;
      const { width, height } = sprite.userData;
      sprite.scale.set(width / pixelsPerUnit, height / pixelsPerUnit, 1);
    }
  }

  createCanvas(label: LabelOptions, extraScale: number): HTMLCanvasElement {
    const theme = this.renderer.colorScheme;
    const fgColor = theme === "dark" ? DARK_COLOR : LIGHT_COLOR;
    const bgColor = theme === "dark" ? DARK_BACKGROUND_COLOR : LIGHT_BACKGROUND_COLOR;

    const color = rgbaToLinear(makeRgba(), label.color ?? fgColor);
    const fontSize = label.fontSize ?? 14;
    const fontFamily = fonts.MONOSPACE;
    const fontWeight = 400;
    // const padding = label.padding ?? 2;
    const backgroundColor = rgbaToLinear(makeRgba(), label.backgroundColor ?? bgColor);
    const outlineWidth = label.outlineWidth ?? 0;
    const outlineColor = rgbaToLinear(makeRgba(), label.outlineColor ?? fgColor);
    const borderRadius = label.borderRadius ?? 0;
    const borderWidth = label.borderWidth ?? 0;
    const borderColor = rgbaToLinear(makeRgba(), label.borderColor ?? fgColor);
    const textAlign = "start";
    const textBaseline = "top";
    const lines = label.text.split("\n");
    const { width: fontWidth, height: fontHeight } = measureText(
      lines,
      fontFamily,
      `${fontSize}px`,
      fontWeight,
      {},
    );

    const canvas = document.createElement("canvas");
    const scale = window.devicePixelRatio + extraScale;
    canvas.width = Math.ceil((fontWidth + borderWidth * 2 + Math.ceil(outlineWidth) * 2) * scale);
    canvas.height = Math.ceil(
      (fontHeight * lines.length + borderWidth * 2 + Math.ceil(outlineWidth) * 2) * scale,
    );
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create canvas context for ThreeDeeRender.Labels");
    }
    // log.debug(`Created ${canvas.width}x${canvas.height}@${scale}x canvas, text="${label.text}"`);
    context.scale(scale, scale);
    context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

    // Draw the path for the background and/or outline
    context.strokeStyle = rgbaToCssString(borderColor);
    context.lineWidth = borderWidth;
    context.lineCap = "butt";
    roundRectPath(
      context,
      borderWidth / 2,
      borderWidth / 2,
      fontWidth + borderWidth + Math.ceil(outlineWidth) * 2,
      fontHeight * lines.length + borderWidth + Math.ceil(outlineWidth) * 2,
      borderRadius,
    );

    // Background color
    context.fillStyle = rgbaToCssString(backgroundColor);
    context.fill();

    // Border
    if (borderWidth > 0) {
      context.stroke();
    }

    context.textAlign = textAlign;
    context.textBaseline = textBaseline;

    const x = borderWidth;
    let y = borderWidth;
    for (const line of lines) {
      // Text outline
      if (outlineWidth > 0) {
        context.strokeStyle = rgbaToCssString(outlineColor);
        context.lineWidth = outlineWidth * 2;
        context.strokeText(line, x, y);
      }

      // Text fill
      context.fillStyle = rgbaToCssString(color);
      context.fillText(line, x, y);

      y += fontHeight;
    }

    return canvas;
  }
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

const textMeasures = new Map<string, textMetrics.TextMeasure>();
function measureText(
  lines: string[],
  fontFamily: string,
  fontSize: string,
  fontWeight: number,
  options: textMetrics.Options,
): { width: number; height: number } {
  // These were determined empirically with the 'Inter' monospace font
  const WIDTH_ADJUSTMENT_PX = 0;
  const HEIGHT_ADJUSTENT_PX = -1;

  const id = `${fontFamily}-${fontSize}-${fontWeight}`;
  let textMeasure = textMeasures.get(id);
  if (!textMeasure) {
    const root = document.getElementById("root");
    if (!root) {
      throw new Error(`Missing root element for measuring text`);
    }
    const div = document.createElement("div");
    div.className = "text-measure";
    root.appendChild(div);
    textMeasure = textMetrics.init(div, { fontFamily, fontSize, fontWeight });
    textMeasures.set(id, textMeasure);
  }

  const line0 = lines[0]!;

  // Compute the text height, with a fallback to the font size if our <div> is
  // currently reporting a line-height of 0 which can happen early in the app
  // lifecycle such as during storybook rendering
  let height = textMeasure.height(line0);
  if (height <= 0) {
    const fontSizePx = parseFloat(fontSize);
    if (isNaN(fontSizePx)) {
      throw new Error(`Could not determine height for font size "${fontSize}"`);
    }
    height = fontSizePx;
  }
  height += HEIGHT_ADJUSTENT_PX;

  // Compute the widest width of each line
  let width = 0;
  for (const line of lines) {
    const lineWidth = textMeasure.width(line, options);
    if (lineWidth > width) {
      width = lineWidth;
    }
  }
  width += WIDTH_ADJUSTMENT_PX;

  return { width, height };
}

function scaleFactor(lod: DetailLevel): number {
  switch (lod) {
    case DetailLevel.High:
      return 4;
    case DetailLevel.Medium:
      return 2;
    case DetailLevel.Low:
      return 1;
  }
}
