// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry";

import { PinholeCameraModel } from "@foxglove/den/image";
import { Color } from "@foxglove/schemas";
import { RosObject, RosValue } from "@foxglove/studio-base/players/types";

import {
  ANNOTATION_RENDER_ORDER,
  annotationRenderOrderMaterialProps,
} from "./annotationRenderOrder";
import { getAnnotationAtPath } from "./normalizeAnnotations";
import {
  PointsAnnotation as NormalizedPointsAnnotation,
  CircleAnnotation as NormalizedCircleAnnotation,
} from "./types";
import { LineMaterialWithAlphaVertex } from "../../../LineMaterialWithAlphaVertex";
import { BaseUserData, Renderable } from "../../../Renderable";
import { SRGBToLinear } from "../../../color";

const tempVec3 = new THREE.Vector3();

class PickingMaterial extends LineMaterialWithAlphaVertex {
  public constructor() {
    super({
      worldUnits: false,
      vertexColors: false,
      linewidth: 0,
      ...annotationRenderOrderMaterialProps,
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

const FALLBACK_COLOR: Color = { r: 0, g: 0, b: 0, a: 0 };

/**
 * Handles rendering of 2D annotations (line list, line strip, and line loop/polygon).
 */
export class RenderableLineAnnotation extends Renderable<BaseUserData, /*TRenderer=*/ undefined> {
  #geometry?: LineSegmentsGeometry;
  readonly #linePrepass: LineSegments2;
  readonly #linePrepassMaterial: LineMaterialWithAlphaVertex;
  readonly #line: LineSegments2;
  readonly #lineMaterial: LineMaterialWithAlphaVertex;
  readonly #linePickingMaterial: PickingMaterial;
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

  #originalMessage?: RosObject;

  #annotation?: NormalizedPointsAnnotation & { style: LineStyle };
  #annotationNeedsUpdate = false;

  #cameraModel?: PinholeCameraModel;
  #cameraModelNeedsUpdate = false;

  public constructor(topicName: string) {
    super(topicName, undefined, {
      receiveTime: 0n,
      messageTime: 0n,
      frameId: "",
      pose: { position: { x: 0, y: 0, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 0 } },
      settingsPath: [],
      settings: { visible: true },
      topic: topicName,
    });

    this.#geometry = new LineSegmentsGeometry();

    // We alleviate corner artifacts using a two-pass render for lines. The
    // first pass writes to depth only, followed by a color pass with stencil
    // operations. The source for this technique is:
    // <https://github.com/mrdoob/three.js/issues/23680#issuecomment-1063294691>
    // <https://gkjohnson.github.io/threejs-sandbox/fat-line-opacity/webgl_lines_fat.html>
    this.#linePrepassMaterial = new LineMaterialWithAlphaVertex({
      worldUnits: false,
      colorWrite: false,
      vertexColors: true,
      linewidth: 0,
      stencilWrite: true,
      stencilRef: 1,
      stencilZPass: THREE.ReplaceStencilOp,
      ...annotationRenderOrderMaterialProps,
    });
    this.#lineMaterial = new LineMaterialWithAlphaVertex({
      worldUnits: false,
      vertexColors: true,
      linewidth: 0,
      stencilWrite: true,
      stencilRef: 0,
      stencilFunc: THREE.NotEqualStencilFunc,
      stencilFail: THREE.ReplaceStencilOp,
      stencilZPass: THREE.ReplaceStencilOp,
      ...annotationRenderOrderMaterialProps,
    });
    this.#linePrepass = new LineSegments2(this.#geometry, this.#linePrepassMaterial);
    this.#linePrepass.renderOrder = ANNOTATION_RENDER_ORDER.LINE_PREPASS;
    this.#linePrepass.userData.picking = false;
    this.add(this.#linePrepass);
    this.#line = new LineSegments2(this.#geometry, this.#lineMaterial);
    this.#line.renderOrder = ANNOTATION_RENDER_ORDER.LINE;
    this.#line.userData.pickingMaterial = this.#linePickingMaterial = new PickingMaterial();
    this.add(this.#line);
  }

  public override dispose(): void {
    this.#geometry?.dispose();
    this.#linePrepassMaterial.dispose();
    this.#lineMaterial.dispose();
    this.#linePickingMaterial.dispose();
    this.#fillGeometry?.dispose();
    this.#fillMaterial?.dispose();
    super.dispose();
  }

  public override details(): Record<string, RosValue> {
    if (this.#originalMessage && this.#annotation) {
      return {
        annotation: getAnnotationAtPath(this.#originalMessage, this.#annotation.messagePath),
        originalMessage: this.#originalMessage,
      };
    }
    return {};
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

  public setAnnotation(
    annotation: NormalizedPointsAnnotation & { style: LineStyle },
    originalMessage: RosObject | undefined,
  ): void {
    this.#annotationNeedsUpdate ||= this.#annotation !== annotation;
    this.#originalMessage = originalMessage;
    this.#annotation = annotation;
  }

  public setAnnotationFromCircle(
    annotation: NormalizedCircleAnnotation,
    originalMessage: RosObject | undefined,
  ): void {
    this.setAnnotation(makePointsAnnotationFromCircle(annotation), originalMessage);
  }

  public update(): void {
    if (!this.#annotation || !this.#cameraModel) {
      this.visible = false;
      return;
    }

    const { points, outlineColor, outlineColors, thickness, style, fillColor } = this.#annotation;
    let pointsLength = points.length;
    if (style === "line_list" && pointsLength % 2 !== 0) {
      pointsLength--;
    }
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
      this.#lineMaterial.lineWidth = thickness * this.#scale;
      this.#lineMaterial.needsUpdate = true;
      this.#linePrepassMaterial.resolution.set(this.#canvasWidth, this.#canvasHeight);
      this.#linePrepassMaterial.lineWidth = thickness * this.#scale;
      this.#linePrepassMaterial.needsUpdate = true;
      this.#linePickingMaterial.resolution.set(this.#canvasWidth, this.#canvasHeight);
      this.#linePickingMaterial.lineWidth = thickness * this.#scale;
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
          case "line_list": {
            this.#positionBuffer = new Float32Array(pointsLength * 3);
            this.#colorBuffer = new Uint8Array(pointsLength * 8);
            this.#geometry = new LineSegmentsGeometry();

            // [rgba, rgba]
            const instanceColorBuffer = new THREE.InstancedInterleavedBuffer(
              this.#colorBuffer,
              8,
              1,
            );
            this.#geometry.setAttribute(
              "instanceColorStart",
              new THREE.InterleavedBufferAttribute(instanceColorBuffer, 4, 0, true),
            );
            this.#geometry.setAttribute(
              "instanceColorEnd",
              new THREE.InterleavedBufferAttribute(instanceColorBuffer, 4, 4, true),
            );
            break;
          }
        }
        this.#linePrepass.geometry = this.#geometry;
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
      for (let i = 0; i < pointsLength; i++) {
        // Support the case where outline_colors is half the length of points, one color per line,
        // and where outline_colors matches the length of points. Fall back to marker.outline_color
        // as needed
        const point = points[i]!;
        this.#cameraModel.projectPixelTo3dPlane(tempVec3, point);

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
        }
        if (i === 0) {
          shape?.moveTo(tempVec3.x, tempVec3.y);
        } else {
          shape?.lineTo(tempVec3.x, tempVec3.y);
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
        if (this.#fillGeometry) {
          this.#fillGeometry.dispose();
          this.#fillGeometry = undefined;
        }
        this.#fillGeometry = new THREE.ShapeGeometry(shape);
        this.#fillMaterial ??= new THREE.MeshBasicMaterial({
          side: THREE.DoubleSide,
          ...annotationRenderOrderMaterialProps,
        });
        if (!this.#fill) {
          this.#fill = new THREE.Mesh(this.#fillGeometry, this.#fillMaterial);
          this.#fill.renderOrder = ANNOTATION_RENDER_ORDER.FILL;
          this.add(this.#fill);
        } else {
          this.#fill.geometry = this.#fillGeometry;
        }
        this.#fill.position.set(0, 0, 1);
        this.#fillMaterial.color
          .setRGB(shapeFillColor.r, shapeFillColor.g, shapeFillColor.b)
          .convertSRGBToLinear();
        this.#fillMaterial.opacity = shapeFillColor.a;
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
        this.#linePrepassMaterial.vertexColors = true;
        this.#lineMaterial.vertexColors = true;
        this.#lineMaterial.color.setRGB(1, 1, 1); // any non-white color will tint the vertex colors
        this.#lineMaterial.setOpacity(1);
        this.#geometry.getAttribute("instanceColorStart").needsUpdate = true;
        this.#geometry.getAttribute("instanceColorEnd").needsUpdate = true;
      } else {
        const color = outlineColor ?? FALLBACK_COLOR;
        this.#linePrepassMaterial.vertexColors = false;
        this.#lineMaterial.vertexColors = false;
        this.#lineMaterial.color.setRGB(color.r, color.g, color.b).convertSRGBToLinear();
        this.#lineMaterial.setOpacity(color.a);
      }
      this.#lineMaterial.needsUpdate = true;

      this.#geometry.setPositions(positions);

      switch (style) {
        // These should represent the number of lines, not the number of points
        case "polygon":
          this.#geometry.instanceCount = pointsLength;
          break;
        case "line_strip":
          this.#geometry.instanceCount = pointsLength - 1;
          break;
        case "line_list":
          this.#geometry.instanceCount = pointsLength >>> 1;
          break;
      }
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
    messagePath: circle.messagePath,
  };
}
