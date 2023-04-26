// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { PinholeCameraModel } from "@foxglove/den/image";
import { Annotation as NormalizedAnnotation } from "@foxglove/studio-base/panels/Image/types";

import { RenderableLineListAnnotation } from "./RenderableLineListAnnotation";
import { RenderablePointsAnnotation } from "./RenderablePointsAnnotation";

/**
 * Holds renderables for all the 2D image annotations on a single topic.
 */
export class RenderableTopicAnnotations extends THREE.Object3D {
  #points: RenderablePointsAnnotation[] = [];
  #lineLists: RenderableLineListAnnotation[] = [];

  #scale = 0;
  #canvasWidth = 0;
  #canvasHeight = 0;
  #pixelRatio = 0;
  #scaleNeedsUpdate = false;

  #annotations: NormalizedAnnotation[] = [];
  #annotationsNeedsUpdate = false;

  #cameraModel?: PinholeCameraModel;
  #cameraModelNeedsUpdate = false;

  public dispose(): void {
    for (const points of this.#points) {
      points.dispose();
    }
    for (const lineList of this.#lineLists) {
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
      for (const lineList of this.#lineLists) {
        lineList.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight, this.#pixelRatio);
      }
    }

    if (this.#cameraModelNeedsUpdate) {
      this.#cameraModelNeedsUpdate = false;
      for (const points of this.#points) {
        points.setCameraModel(this.#cameraModel);
      }
      for (const lineList of this.#lineLists) {
        lineList.setCameraModel(this.#cameraModel);
      }
    }

    const updateRenderables = () => {
      for (const points of this.#points) {
        points.update();
      }
      for (const lineList of this.#lineLists) {
        lineList.update();
      }
    };

    if (!this.#annotationsNeedsUpdate) {
      updateRenderables();
      return;
    }

    this.#annotationsNeedsUpdate = false;

    const unusedPoints = this.#points;
    this.#points = [];
    const unusedLineLists = this.#lineLists;
    this.#lineLists = [];

    for (const annotation of this.#annotations) {
      switch (annotation.type) {
        case "circle":
          // not yet implemented
          break;

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
              // not yet implemented
              break;

            case "line_strip":
              // not yet implemented
              break;

            case "line_list": {
              let lineList = unusedLineLists.pop();
              if (!lineList) {
                lineList = new RenderableLineListAnnotation();
                lineList.setScale(
                  this.#scale,
                  this.#canvasWidth,
                  this.#canvasHeight,
                  this.#pixelRatio,
                );
                lineList.setCameraModel(this.#cameraModel);
                this.add(lineList);
              }
              this.#lineLists.push(lineList);
              lineList.setAnnotation(
                annotation as typeof annotation & { style: typeof annotation.style },
              );
              break;
            }
          }
          break;

        case "text":
          // not yet implemented
          break;
      }
    }

    updateRenderables();

    for (const points of unusedPoints) {
      points.removeFromParent();
      points.dispose();
    }
    for (const lineList of unusedLineLists) {
      lineList.removeFromParent();
      lineList.dispose();
    }
  }
}
