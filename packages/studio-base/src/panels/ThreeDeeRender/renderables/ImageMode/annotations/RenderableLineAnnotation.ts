// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry";

import { PinholeCameraModel } from "@foxglove/den/image";
import { Color } from "@foxglove/schemas";
import {
  PointsAnnotation as NormalizedPointsAnnotation,
  CircleAnnotation as NormalizedCircleAnnotation,
} from "@foxglove/studio-base/panels/Image/types";

import { BaseUserData, Renderable } from "../../../Renderable";
import { SRGBToLinear } from "../../../color";

const tempVec3 = new THREE.Vector3();

class PickingMaterial extends LineMaterial {
  public constructor() {
    super({
      worldUnits: false,
      vertexColors: false,
      linewidth: 0,
      transparent: false,
      depthWrite: true,
    });
    this.uniforms.objectId = { value: [NaN, NaN, NaN, NaN] };
  }

  public override onBeforeCompile(shader: THREE.Shader, renderer: THREE.WebGLRenderer): void {
    super.onBeforeCompile(shader, renderer);
    shader.fragmentShader = /* glsl */ `
      uniform vec4 objectId;
      void main() {
        gl_FragColor = objectId;
      }
    `;
  }
}

/** subset of {@link NormalizedPointsAnnotation.style} */
type LineStyle = "polygon" | "line_strip" | "line_list";

enum RenderOrder {
  FILL = 1,
  LINE = 2,
}

const FALLBACK_COLOR: Color = { r: 0, g: 0, b: 0, a: 0 };

/**
 * Handles rendering of 2D annotations (line list, line strip, and line loop/polygon).
 */
export class RenderableLineAnnotation extends Renderable<BaseUserData, /*TRenderer=*/ undefined> {
  #geometry?: LineSegmentsGeometry;
  #line: LineSegments2;
  #linePickingMaterial: PickingMaterial;
  #lineMaterial: LineMaterial;
  /** Style that was last used for configuring geometry */
  #style?: LineStyle;
  /** Number of points that was last used for configuring geometry */
  #numPoints?: number;
  #positionBuffer = new Float32Array();
  #colorBuffer = new Uint8Array();

  #fill?: THREE.Mesh;
  #fillGeometry?: THREE.ShapeGeometry;
  #fillMaterial?: THREE.MeshBasicMaterial;

  #scale = 0;
  #canvasWidth = 0;
  #canvasHeight = 0;
  #scaleNeedsUpdate = false;

  #annotation?: NormalizedPointsAnnotation & { style: LineStyle };
  #annotationNeedsUpdate = false;

  #cameraModel?: PinholeCameraModel;
  #cameraModelNeedsUpdate = false;

  public constructor() {
    super("foxglove.ImageAnnotations.Line", undefined, {
      receiveTime: 0n,
      messageTime: 0n,
      frameId: "",
      pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 0 } },
      settingsPath: [],
      settings: { visible: true },
    });

    this.#geometry = new LineSegmentsGeometry();
    this.#lineMaterial = new LineMaterial({
      worldUnits: false,
      vertexColors: true,
      linewidth: 0,
      transparent: false,
      depthWrite: true,
    });
    this.#line = new LineSegments2(this.#geometry, this.#lineMaterial);
    this.#line.renderOrder = RenderOrder.LINE;
    this.#line.userData.pickingMaterial = this.#linePickingMaterial = new PickingMaterial();
    this.add(this.#line);
  }

  public override dispose(): void {
    this.#geometry?.dispose();
    this.#lineMaterial.dispose();
    this.#linePickingMaterial.dispose();
    this.#fillGeometry?.dispose();
    this.#fillMaterial?.dispose();
    super.dispose();
  }

  public setScale(
    scale: number,
    canvasWidth: number,
    canvasHeight: number,
    _pixelRatio: number,
  ): void {
    this.#scaleNeedsUpdate ||=
      scale !== this.#scale ||
      canvasWidth !== this.#canvasWidth ||
      canvasHeight !== this.#canvasHeight;
    this.#scale = scale;
    this.#canvasWidth = canvasWidth;
    this.#canvasHeight = canvasHeight;
  }

  public setCameraModel(cameraModel: PinholeCameraModel | undefined): void {
    this.#cameraModelNeedsUpdate ||= this.#cameraModel !== cameraModel;
    this.#cameraModel = cameraModel;
  }

  public setAnnotation(annotation: NormalizedPointsAnnotation & { style: LineStyle }): void {
    this.#annotationNeedsUpdate ||= this.#annotation !== annotation;
    this.#annotation = annotation;
  }

  public setAnnotationFromCircle(annotation: NormalizedCircleAnnotation): void {
    this.setAnnotation(makePointsAnnotationFromCircle(annotation));
  }

  public update(): void {
    if (!this.#annotation || !this.#cameraModel) {
      this.visible = false;
      return;
    }

    const { points, outlineColor, outlineColors, thickness, style, fillColor } = this.#annotation;
    const pointsLength = points.length;
    if (pointsLength < 2) {
      this.visible = false;
      return;
    }
    this.visible = true;

    const isPolygon = style === "polygon";
    const isLineStrip = style === "line_strip";
    const isLineList = style === "line_list";

    // Update line width if thickness or scale has changed
    if (this.#annotationNeedsUpdate || this.#scaleNeedsUpdate) {
      this.#lineMaterial.resolution.set(this.#canvasWidth, this.#canvasHeight);
      this.#lineMaterial.linewidth = thickness * this.#scale;
      this.#lineMaterial.needsUpdate = true;
      this.#linePickingMaterial.resolution.set(this.#canvasWidth, this.#canvasHeight);
      this.#linePickingMaterial.linewidth = thickness * this.#scale;
      this.#linePickingMaterial.needsUpdate = true;
      this.#scaleNeedsUpdate = false;
    }

    if (this.#annotationNeedsUpdate || this.#cameraModelNeedsUpdate) {
      this.#annotationNeedsUpdate = false;
      this.#cameraModelNeedsUpdate = false;
      if (
        this.#numPoints == undefined ||
        !this.#geometry ||
        pointsLength > this.#numPoints ||
        this.#style !== style
      ) {
        // Need to recreate the geometry when length changes: https://github.com/mrdoob/three.js/issues/21488
        this.#geometry?.dispose();
        this.#numPoints = pointsLength;
        this.#style = style;
        switch (style) {
          case "polygon":
            this.#positionBuffer = new Float32Array((pointsLength + 1) * 3);
            // color buffer is unused (we don't use vertex colors)
            this.#geometry = new LineGeometry();
            break;
          case "line_strip":
            this.#positionBuffer = new Float32Array(pointsLength * 3);
            // color buffer is unused (we don't use vertex colors)
            this.#geometry = new LineGeometry();
            break;
          case "line_list":
            this.#positionBuffer = new Float32Array(pointsLength * 3);
            this.#colorBuffer = new Uint8Array(pointsLength * 8);
            this.#geometry = new LineSegmentsGeometry();
            break;
        }
        this.#line.geometry = this.#geometry;
      }

      const useVertexColors = isLineList;
      const hasExactColors = outlineColors.length === pointsLength / 2;

      const shapeFillColor =
        (isPolygon || isLineStrip) && fillColor != undefined && fillColor.a > 0
          ? fillColor
          : undefined;
      const shape = shapeFillColor ? new THREE.Shape() : undefined;

      const positions = this.#positionBuffer;
      const colors = this.#colorBuffer;
      let hasTransparency = false;
      for (let i = 0; i < pointsLength; i++) {
        // Support the case where outline_colors is half the length of points, one color per line,
        // and where outline_colors matches the length of points. Fall back to marker.outline_color
        // as needed
        const point = points[i]!;
        if (this.#cameraModel.projectPixelTo3dPlane(tempVec3, point)) {
          positions[i * 3 + 0] = tempVec3.x;
          positions[i * 3 + 1] = tempVec3.y;
          positions[i * 3 + 2] = tempVec3.z;
          if (useVertexColors) {
            const color = hasExactColors
              ? outlineColors[i >>> 1]!
              : outlineColors[i] ?? outlineColor ?? FALLBACK_COLOR;
            colors[i * 4 + 0] = SRGBToLinear(color.r) * 255;
            colors[i * 4 + 1] = SRGBToLinear(color.g) * 255;
            colors[i * 4 + 2] = SRGBToLinear(color.b) * 255;
            colors[i * 4 + 3] = color.a * 255;
            if (color.a < 1) {
              hasTransparency = true;
            }
          }
          if (i === 0) {
            shape?.moveTo(tempVec3.x, tempVec3.y);
          } else {
            shape?.lineTo(tempVec3.x, tempVec3.y);
          }
        } else {
          positions[i * 3 + 0] = NaN;
          positions[i * 3 + 1] = NaN;
          positions[i * 3 + 2] = NaN;
        }
      }

      // Add another point to close the polygon
      if (isPolygon) {
        positions[pointsLength * 3 + 0] = positions[0]!;
        positions[pointsLength * 3 + 1] = positions[1]!;
        positions[pointsLength * 3 + 2] = positions[2]!;
        if (useVertexColors) {
          colors[pointsLength * 4 + 0] = colors[0]!;
          colors[pointsLength * 4 + 1] = colors[1]!;
          colors[pointsLength * 4 + 2] = colors[2]!;
          colors[pointsLength * 4 + 3] = colors[3]!;
        }
        shape?.closePath();
      }

      if (shapeFillColor) {
        this.#fillGeometry ??= new THREE.ShapeGeometry(shape);
        this.#fillMaterial ??= new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
        if (!this.#fill) {
          this.#fill = new THREE.Mesh(this.#fillGeometry, this.#fillMaterial);
          this.#fill.renderOrder = RenderOrder.FILL;
          this.add(this.#fill);
        }
        this.#fill.position.set(0, 0, 1);
        this.#fillMaterial.color
          .setRGB(shapeFillColor.r, shapeFillColor.g, shapeFillColor.b)
          .convertSRGBToLinear();
        this.#fillMaterial.opacity = shapeFillColor.a;
        const fillHasTransparency = shapeFillColor.a < 1;
        this.#fillMaterial.transparent = fillHasTransparency;
        this.#fillMaterial.depthWrite = !fillHasTransparency;
        this.#fillMaterial.needsUpdate = true;
      } else {
        this.#fillGeometry?.dispose();
        this.#fillMaterial?.dispose();
        this.#fill?.removeFromParent();
        this.#fillGeometry = undefined;
        this.#fillMaterial = undefined;
        this.#fill = undefined;
      }

      if (useVertexColors) {
        this.#lineMaterial.vertexColors = true;
      } else {
        const color = outlineColor ?? FALLBACK_COLOR;
        this.#lineMaterial.vertexColors = false;
        this.#lineMaterial.color.setRGB(color.r, color.g, color.b).convertSRGBToLinear();
        this.#lineMaterial.opacity = color.a;
        hasTransparency = color.a < 1;
      }
      this.#lineMaterial.transparent = hasTransparency;
      this.#lineMaterial.depthWrite = !hasTransparency;
      this.#lineMaterial.needsUpdate = true;

      this.#geometry.setPositions(positions);

      switch (style) {
        case "polygon":
          this.#geometry.instanceCount = pointsLength + 1;
          break;
        case "line_strip":
          this.#geometry.instanceCount = pointsLength;
          break;
        case "line_list":
          this.#geometry.instanceCount = pointsLength >>> 1;
          break;
      }

      // [rgba, rgba]
      const instanceColorBuffer = new THREE.InstancedInterleavedBuffer(colors, 8, 1);
      this.#geometry.setAttribute(
        "instanceColorStart",
        new THREE.InterleavedBufferAttribute(instanceColorBuffer, 4, 0, true),
      );
      this.#geometry.setAttribute(
        "instanceColorEnd",
        new THREE.InterleavedBufferAttribute(instanceColorBuffer, 4, 4, true),
      );
    }
  }
}

function makePointsAnnotationFromCircle(
  circle: NormalizedCircleAnnotation,
): NormalizedPointsAnnotation & { style: LineStyle } {
  const segments = 32;
  const {
    position: { x: cx, y: cy },
    radius,
  } = circle;
  return {
    type: "points",
    stamp: circle.stamp,
    style: "polygon",
    points: new Array(segments).fill(undefined).map((_, index) => {
      const angle = (2 * Math.PI * index) / segments;
      return {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      };
    }),
    outlineColors: [],
    outlineColor: circle.outlineColor,
    thickness: circle.thickness,
    fillColor: circle.fillColor,
  };
}
