// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import EventEmitter from "eventemitter3";
import * as THREE from "three";
import { Key } from "ts-key-enum";

const MAX_DIST = 1;

const tempVec2 = new THREE.Vector2();

export type InputEvents = {
  resize: (windowSize: THREE.Vector2) => void;
  click: (cursorCoords: THREE.Vector2, event: MouseEvent) => void;
  mousedown: (cursorCoords: THREE.Vector2, event: MouseEvent) => void;
  mousemove: (cursorCoords: THREE.Vector2, event: MouseEvent) => void;
  keydown: (key: Key, event: KeyboardEvent) => void;
};

export class Input extends EventEmitter<InputEvents> {
  readonly canvas: HTMLCanvasElement;
  canvasSize: THREE.Vector2;
  resizeObserver: ResizeObserver;
  startClientPos?: THREE.Vector2;
  cursorCoords = new THREE.Vector2();

  constructor(canvas: HTMLCanvasElement) {
    super();

    const parentEl = canvas.parentElement;
    if (!parentEl) {
      throw new Error("<canvas> must be parented to a DOM element");
    }

    this.canvas = canvas;
    this.canvasSize = new THREE.Vector2(canvas.width, canvas.height);

    this.resizeObserver = new ResizeObserver(this.onResize);
    this.resizeObserver.observe(parentEl);

    canvas.addEventListener("mousedown", this.onMouseDown);
    canvas.addEventListener("mousemove", this.onMouseMove);
    canvas.addEventListener("click", this.onClick);
    canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
    canvas.addEventListener("touchend", this.onTouchEnd, { passive: false });
    canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
    canvas.addEventListener("touchcancel", this.onTouchCancel, { passive: false });
  }

  dispose(): void {
    const canvas = this.canvas;

    this.removeAllListeners();
    this.resizeObserver.disconnect();

    canvas.removeEventListener("mousedown", this.onMouseDown);
    canvas.removeEventListener("mousemove", this.onMouseMove);
    canvas.removeEventListener("click", this.onClick);
    canvas.removeEventListener("touchstart", this.onTouchStart);
    canvas.removeEventListener("touchend", this.onTouchEnd);
    canvas.removeEventListener("touchmove", this.onTouchMove);
    canvas.removeEventListener("touchcancel", this.onTouchCancel);
  }

  onResize = (_entries: ResizeObserverEntry[]): void => {
    if (this.canvas.parentElement) {
      const newSize = innerSize(this.canvas.parentElement);
      if (isNaN(newSize.width) || isNaN(newSize.height)) {
        return;
      }
      if (newSize.width !== this.canvasSize.width || newSize.height !== this.canvasSize.height) {
        this.canvasSize.width = newSize.width;
        this.canvasSize.height = newSize.height;
        this.emit("resize", this.canvasSize);
      }
    }
  };

  onMouseDown = (event: MouseEvent): void => {
    this.startClientPos = new THREE.Vector2(event.offsetX, event.offsetY);
    this.emit("mousedown", this.cursorCoords, event);
  };

  onMouseMove = (event: MouseEvent): void => {
    this.updateCursorCoords(event);
    this.emit("mousemove", this.cursorCoords, event);
  };

  onClick = (event: MouseEvent): void => {
    if (!this.startClientPos) {
      return;
    }

    const dist = this.startClientPos.distanceTo(tempVec2.set(event.offsetX, event.offsetY));
    this.startClientPos = undefined;

    if (dist > MAX_DIST) {
      return;
    }

    this.updateCursorCoords(event);
    this.emit("click", this.cursorCoords, event);
  };

  onTouchStart = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (touch) {
      this.startClientPos = new THREE.Vector2(touch.clientX, touch.clientY);
    }
    event.preventDefault();
  };

  onTouchEnd = (event: TouchEvent): void => {
    event.preventDefault();
  };

  onTouchMove = (event: TouchEvent): void => {
    event.preventDefault();
  };

  onTouchCancel = (event: TouchEvent): void => {
    event.preventDefault();
  };

  private updateCursorCoords(event: MouseEvent): void {
    this.cursorCoords.x = event.offsetX;
    this.cursorCoords.y = event.offsetY;
  }
}

function innerSize(node: HTMLElement) {
  const cs = getComputedStyle(node);

  const paddingX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const paddingY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);

  const borderX = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
  const borderY = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);

  const width = node.clientWidth - paddingX - borderX;
  const height = node.clientHeight - paddingY - borderY;

  return { width, height };
}
