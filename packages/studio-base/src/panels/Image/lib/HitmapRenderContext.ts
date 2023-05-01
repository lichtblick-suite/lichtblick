// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { indexToIDColor } from "./util";

/**
 * This wraps a canvas rendering context to also render all context commands in parallel
 * to a separate hitmap context.
 */
export class HitmapRenderContext {
  #currentMarkerIndex: number = 0;
  readonly #hctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | undefined;

  public constructor(
    private readonly _ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    private readonly _hitmapCanvas: HTMLCanvasElement | OffscreenCanvas | undefined,
  ) {
    this.#hctx = this._hitmapCanvas?.getContext("2d") ?? undefined;
    if (this.#hctx) {
      this.#hctx.imageSmoothingEnabled = false;
      this.#hctx.clearRect(0, 0, this._ctx.canvas.width, this._ctx.canvas.height);
    }
  }

  public startMarker(): void {
    if (this.#hctx) {
      const colorString = indexToIDColor(this.#currentMarkerIndex);
      this.#hctx.fillStyle = `#${colorString}ff`;
      this.#hctx.strokeStyle = `#${colorString}ff`;
    }
    this.#currentMarkerIndex++;
  }

  // eslint-disable-next-line no-restricted-syntax
  public get lineWidth(): number {
    return this._ctx.lineWidth;
  }

  // eslint-disable-next-line no-restricted-syntax
  public set lineWidth(width: number) {
    this._ctx.lineWidth = width;
    if (this.#hctx) {
      this.#hctx.lineWidth = width;
    }
  }

  // eslint-disable-next-line no-restricted-syntax
  public get fillStyle(): CanvasRenderingContext2D["fillStyle"] {
    return this._ctx.fillStyle;
  }

  // eslint-disable-next-line no-restricted-syntax
  public set fillStyle(style: CanvasRenderingContext2D["fillStyle"]) {
    this._ctx.fillStyle = style;
  }

  // eslint-disable-next-line no-restricted-syntax
  public get font(): string {
    return this._ctx.font;
  }

  // eslint-disable-next-line no-restricted-syntax
  public set font(font: string) {
    this._ctx.font = font;
    if (this.#hctx) {
      this.#hctx.font = font;
    }
  }

  // eslint-disable-next-line no-restricted-syntax
  public get strokeStyle(): CanvasRenderingContext2D["strokeStyle"] {
    return this._ctx.strokeStyle;
  }

  // eslint-disable-next-line no-restricted-syntax
  public set strokeStyle(style: CanvasRenderingContext2D["strokeStyle"]) {
    this._ctx.strokeStyle = style;
  }

  // eslint-disable-next-line no-restricted-syntax
  public get textBaseline(): CanvasRenderingContext2D["textBaseline"] {
    return this._ctx.textBaseline;
  }

  // eslint-disable-next-line no-restricted-syntax
  public set textBaseline(baseline: CanvasRenderingContext2D["textBaseline"]) {
    this._ctx.textBaseline = baseline;
    if (this.#hctx) {
      this.#hctx.textBaseline = baseline;
    }
  }

  public arc(
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    counterclockwise?: boolean,
  ): void {
    this._ctx.arc(x, y, radius, startAngle, endAngle, counterclockwise);
    this.#hctx?.arc(x, y, radius, startAngle, endAngle, counterclockwise);
  }

  public beginPath(): void {
    this._ctx.beginPath();
    this.#hctx?.beginPath();
  }

  public clearRect(x: number, y: number, w: number, h: number): void {
    this._ctx.clearRect(x, y, w, h);
    this.#hctx?.clearRect(x, y, w, h);
  }

  public closePath(): void {
    this._ctx.closePath();
    this.#hctx?.closePath();
  }

  public drawImage(image: CanvasImageSource, dx: number, dy: number): void {
    // Don't draw into hit context.
    this._ctx.drawImage(image, dx, dy);
  }

  public fill(): void {
    this._ctx.fill();
    this.#hctx?.fill();
  }

  public fillRect(x: number, y: number, w: number, h: number): void {
    this._ctx.fillRect(x, y, w, h);
    this.#hctx?.fillRect(x, y, w, h);
  }

  public fillText(text: string, x: number, y: number): void {
    this._ctx.fillText(text, x, y);
    this.#hctx?.fillText(text, x, y);
  }

  public getTransform(): DOMMatrix {
    return this._ctx.getTransform();
  }

  public lineTo(x: number, y: number): void {
    this._ctx.lineTo(x, y);
    this.#hctx?.lineTo(x, y);
  }

  public measureText(text: string): TextMetrics {
    return this._ctx.measureText(text);
  }

  public moveTo(x: number, y: number): void {
    this._ctx.moveTo(x, y);
    this.#hctx?.moveTo(x, y);
  }

  public restore(): void {
    this._ctx.restore();
    this.#hctx?.restore();
  }

  public rotate(angle: number): void {
    const rads = (angle * Math.PI) / 180;
    this._ctx.rotate(rads);
    this.#hctx?.rotate(rads);
  }

  public save(): void {
    this._ctx.save();
    this.#hctx?.save();
  }

  public scale(x: number, y: number): void {
    this._ctx.scale(x, y);
    this.#hctx?.scale(x, y);
  }

  public stroke(): void {
    this._ctx.stroke();
    this.#hctx?.stroke();
  }

  public strokeRect(x: number, y: number, w: number, h: number): void {
    this._ctx.strokeRect(x, y, w, h);
    this.#hctx?.strokeRect(x, y, w, h);
  }

  public translate(x: number, y: number): void {
    this._ctx.translate(x, y);
    this.#hctx?.translate(x, y);
  }
}
