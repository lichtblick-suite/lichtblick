// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { PinholeCameraModel } from "@foxglove/den/image";
import { Annotation as NormalizedAnnotation } from "@foxglove/studio-base/panels/Image/types";
import { LabelPool } from "@foxglove/three-text";

import { RenderableLineAnnotation } from "./RenderableLineAnnotation";
import { RenderablePointsAnnotation } from "./RenderablePointsAnnotation";
import { RenderableTextAnnotation } from "./RenderableTextAnnotation";

/**
 * Holds renderables for all the 2D image annotations on a single topic.
 */
export class RenderableTopicAnnotations extends THREE.Object3D {
  #labelPool: LabelPool;
  #points: RenderablePointsAnnotation[] = [];
  #lines: RenderableLineAnnotation[] = [];
  #texts: RenderableTextAnnotation[] = [];

  #scale = 0;
  #canvasWidth = 0;
  #canvasHeight = 0;
  #pixelRatio = 0;
  #scaleNeedsUpdate = false;

  #annotations: NormalizedAnnotation[] = [];
  #annotationsNeedsUpdate = false;

  #cameraModel?: PinholeCameraModel;
  #cameraModelNeedsUpdate = false;

  public constructor(labelPool: LabelPool) {
    super();
    this.#labelPool = labelPool;
  }

  public dispose(): void {
    for (const points of this.#points) {
      points.dispose();
    }
    for (const lineList of this.#lines) {
      lineList.dispose();
    }
  }

  public setScale(
    scale: number,
    canvasWidth: number,
    canvasHeight: number,
    pixelRatio: number,
  ): void {
    this.#scaleNeedsUpdate ||= this.#scale !== scale;
    this.#scale = scale;
    this.#canvasWidth = canvasWidth;
    this.#canvasHeight = canvasHeight;
    this.#pixelRatio = pixelRatio;
  }

  public setCameraModel(cameraModel: PinholeCameraModel | undefined): void {
    this.#cameraModelNeedsUpdate ||= this.#cameraModel !== cameraModel;
    this.#cameraModel = cameraModel;
  }

  public setAnnotations(annotations: NormalizedAnnotation[]): void {
    this.#annotationsNeedsUpdate ||= this.#annotations !== annotations;
    this.#annotations = annotations;
  }

  public update(): void {
    if (this.#scaleNeedsUpdate) {
      this.#scaleNeedsUpdate = false;
      for (const points of this.#points) {
        points.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight, this.#pixelRatio);
      }
      for (const lineList of this.#lines) {
        lineList.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight, this.#pixelRatio);
      }
      for (const text of this.#texts) {
        text.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight, this.#pixelRatio);
      }
    }

    if (this.#cameraModelNeedsUpdate) {
      this.#cameraModelNeedsUpdate = false;
      for (const points of this.#points) {
        points.setCameraModel(this.#cameraModel);
      }
      for (const lineList of this.#lines) {
        lineList.setCameraModel(this.#cameraModel);
      }
      for (const text of this.#texts) {
        text.setCameraModel(this.#cameraModel);
      }
    }

    const updateRenderables = () => {
      for (const points of this.#points) {
        points.update();
      }
      for (const lineList of this.#lines) {
        lineList.update();
      }
      for (const text of this.#texts) {
        text.update();
      }
    };

    if (!this.#annotationsNeedsUpdate) {
      updateRenderables();
      return;
    }

    this.#annotationsNeedsUpdate = false;

    const unusedPoints = this.#points;
    this.#points = [];
    const unusedLines = this.#lines;
    this.#lines = [];
    const unusedTexts = this.#texts;
    this.#texts = [];

    for (const annotation of this.#annotations) {
      switch (annotation.type) {
        case "circle": {
          let line = unusedLines.pop();
          if (!line) {
            line = new RenderableLineAnnotation();
            line.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight, this.#pixelRatio);
            line.setCameraModel(this.#cameraModel);
            this.add(line);
          }
          this.#lines.push(line);
          line.setAnnotationFromCircle(annotation);
          break;
        }

        case "points":
          switch (annotation.style) {
            case "points": {
              let points = unusedPoints.pop();
              if (!points) {
                points = new RenderablePointsAnnotation();
                points.setScale(
                  this.#scale,
                  this.#canvasWidth,
                  this.#canvasHeight,
                  this.#pixelRatio,
                );
                points.setCameraModel(this.#cameraModel);
                this.add(points);
              }
              this.#points.push(points);
              points.setAnnotation(
                annotation as typeof annotation & { style: typeof annotation.style },
              );
              break;
            }

            case "polygon":
            case "line_strip":
            case "line_list": {
              let line = unusedLines.pop();
              if (!line) {
                line = new RenderableLineAnnotation();
                line.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight, this.#pixelRatio);
                line.setCameraModel(this.#cameraModel);
                this.add(line);
              }
              this.#lines.push(line);
              line.setAnnotation(
                annotation as typeof annotation & { style: typeof annotation.style },
              );
              break;
            }
          }
          break;

        case "text": {
          let text = unusedTexts.pop();
          if (!text) {
            text = new RenderableTextAnnotation(this.#labelPool);
            text.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight, this.#pixelRatio);
            text.setCameraModel(this.#cameraModel);
            this.add(text);
          }
          this.#texts.push(text);
          text.setAnnotation(annotation);
          break;
        }
      }
    }

    updateRenderables();

    for (const points of unusedPoints) {
      points.removeFromParent();
      points.dispose();
    }
    for (const lineList of unusedLines) {
      lineList.removeFromParent();
      lineList.dispose();
    }
    for (const text of unusedTexts) {
      text.removeFromParent();
      text.dispose();
    }
  }
}
