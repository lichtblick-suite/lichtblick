// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";

import { SettingsTreeAction, SettingsTreeFields } from "@foxglove/studio";
import { Label } from "@foxglove/three-text";

import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { getLuminance, stringToRgb } from "../color";
import { BaseSettings } from "../settings";
import { Duration, Transform, makePose, CoordinateFrame, MAX_DURATION } from "../transforms";
import { Axis } from "./Axis";
import {
  DEFAULT_AXIS_SCALE,
  DEFAULT_LINE_COLOR_STR,
  DEFAULT_LINE_WIDTH_PX,
  DEFAULT_TF_LABEL_SIZE,
} from "./CoreSettings";
import { makeLinePickingMaterial } from "./markers/materials";

export type LayerSettingsTransform = BaseSettings;

const PICKING_LINE_SIZE = 6;
const PI_2 = Math.PI / 2;

const DEFAULT_SETTINGS: LayerSettingsTransform = {
  visible: true,
  frameLocked: true,
};

export type FrameAxisUserData = BaseUserData & {
  axis: Axis;
  label: Label;
  parentLine: Line2;
};

class FrameAxisRenderable extends Renderable<FrameAxisUserData> {
  override dispose(): void {
    this.renderer.labelPool.release(this.userData.label);
    super.dispose();
  }
}

const tempVec = new THREE.Vector3();
const tempVecB = new THREE.Vector3();
const tempLower: [Duration, Transform] = [0n, Transform.Identity()];
const tempUpper: [Duration, Transform] = [0n, Transform.Identity()];
const tempQuaternion = new THREE.Quaternion();
const tempEuler = new THREE.Euler();

export class FrameAxes extends SceneExtension<FrameAxisRenderable> {
  private static lineGeometry: LineGeometry | undefined;

  lineMaterial: LineMaterial;
  linePickingMaterial: THREE.ShaderMaterial;

  private labelForegroundColor = 1;
  private labelBackgroundColor = new THREE.Color();

  constructor(renderer: Renderer) {
    super("foxglove.FrameAxes", renderer);

    const linewidth = this.renderer.config.scene.transforms?.lineWidth ?? DEFAULT_LINE_WIDTH_PX;
    const color = stringToRgb(
      new THREE.Color(),
      this.renderer.config.scene.transforms?.lineColor ?? DEFAULT_LINE_COLOR_STR,
    );
    this.lineMaterial = new LineMaterial({ linewidth });
    this.lineMaterial.color = color;

    const options = { resolution: renderer.input.canvasSize, worldUnits: false };
    this.linePickingMaterial = makeLinePickingMaterial(PICKING_LINE_SIZE, options);

    renderer.on("transformTreeUpdated", this.handleTransformTreeUpdated);
    renderer.on("startFrame", () => this.updateSettingsTree());

    this.visible = renderer.config.scene.transforms?.visible ?? true;
  }

  override dispose(): void {
    this.renderer.off("transformTreeUpdated", this.handleTransformTreeUpdated);
    this.lineMaterial.dispose();
    this.linePickingMaterial.dispose();
    super.dispose();
  }

  override settingsNodes(): SettingsTreeEntry[] {
    const configTransforms = this.renderer.config.transforms;
    const handler = this.handleSettingsAction;
    const frameCount = this.renderer.coordinateFrameList.length;
    const entries: SettingsTreeEntry[] = [
      {
        path: ["transforms"],
        node: {
          label: `Transforms${frameCount > 0 ? ` (${frameCount})` : ""}`,
          visible: this.renderer.config.scene.transforms?.visible ?? true,
          handler,
        },
      },
    ];

    let i = 0;
    for (const { label, value: frameId } of this.renderer.coordinateFrameList) {
      const config = (configTransforms[frameId] ?? {}) as Partial<LayerSettingsTransform>;
      const fields = buildSettingsFields(
        this.renderer.transformTree.frame(frameId),
        this.renderer.currentTime,
      );

      entries.push({
        path: ["transforms", frameId],
        node: { label, fields, visible: config.visible ?? true, order: i++, handler },
      });
    }

    return entries;
  }

  override startFrame(currentTime: bigint, renderFrameId: string, fixedFrameId: string): void {
    this.lineMaterial.resolution = this.renderer.input.canvasSize;

    super.startFrame(currentTime, renderFrameId, fixedFrameId);

    // Update the lines between coordinate frames
    for (const renderable of this.renderables.values()) {
      const line = renderable.userData.parentLine;
      line.visible = false;
      const childFrame = this.renderer.transformTree.frame(renderable.userData.frameId);
      const parentFrame = childFrame?.parent();
      if (parentFrame) {
        const parentRenderable = this.renderables.get(parentFrame.id);
        if (parentRenderable?.visible === true) {
          parentRenderable.getWorldPosition(tempVec);
          const dist = tempVec.distanceTo(renderable.getWorldPosition(tempVecB));
          line.lookAt(tempVec);
          line.rotateY(-PI_2);
          line.scale.set(dist, 1, 1);
          line.visible = true;
        }
      }
    }
  }

  override setColorScheme(
    colorScheme: "dark" | "light",
    backgroundColor: THREE.Color | undefined,
  ): void {
    const foreground = colorScheme === "dark" ? 1 : 0;
    this.labelForegroundColor = foreground;
    this.labelBackgroundColor.setRGB(1 - foreground, 1 - foreground, 1 - foreground);
    if (backgroundColor) {
      this.labelForegroundColor =
        getLuminance(backgroundColor.r, backgroundColor.g, backgroundColor.b) > 0.5 ? 0 : 1;
      this.labelBackgroundColor.copy(backgroundColor);
    }

    for (const renderable of this.renderables.values()) {
      renderable.userData.label.setColor(
        this.labelForegroundColor,
        this.labelForegroundColor,
        this.labelForegroundColor,
      );
      renderable.userData.label.setBackgroundColor(
        this.labelBackgroundColor.r,
        this.labelBackgroundColor.g,
        this.labelBackgroundColor.b,
      );
    }
  }

  // eslint-disable-next-line @foxglove/no-boolean-parameters
  setLabelVisible(visible: boolean): void {
    for (const renderable of this.renderables.values()) {
      renderable.userData.label.visible = visible;
    }
  }

  setLabelSize(size: number): void {
    for (const renderable of this.renderables.values()) {
      renderable.userData.label.setLineHeight(size);
    }
  }

  setAxisScale(scale: number): void {
    for (const renderable of this.renderables.values()) {
      renderable.userData.axis.scale.set(scale, scale, scale);
    }
  }

  setLineWidth(width: number): void {
    this.lineMaterial.linewidth = width;
  }

  setLineColor(color: string): void {
    stringToRgb(this.lineMaterial.color, color);
  }

  handleSettingsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;
    if (action.action !== "update") {
      return;
    }

    if (path.length === 2 && path[0] === "transforms") {
      const visible = action.payload.value as boolean | undefined;
      this.saveSetting(["scene", "transforms", "visible"], visible);

      if (path[1] === "visible") {
        this.visible = visible ?? true;
      }

      return;
    }

    if (path.length !== 3) {
      return; // Doesn't match the pattern of ["transforms", frameId, field]
    }

    this.saveSetting(path, action.payload.value);

    // Update the renderable
    const frameId = path[1]!;
    const renderable = this.renderables.get(frameId);
    if (renderable) {
      const settings = this.renderer.config.transforms[frameId] as
        | Partial<LayerSettingsTransform>
        | undefined;
      renderable.userData.settings = { ...DEFAULT_SETTINGS, ...settings };
    }
  };

  handleTransformTreeUpdated = (): void => {
    for (const frameId of this.renderer.transformTree.frames().keys()) {
      this._addFrameAxis(frameId);
    }
    this.updateSettingsTree();
  };

  private _addFrameAxis(frameId: string): void {
    if (this.renderables.has(frameId)) {
      return;
    }

    const frame = this.renderer.transformTree.frame(frameId);
    if (!frame) {
      throw new Error(`CoordinateFrame "${frameId}" was not created`);
    }

    // Text label
    const text = frame.displayName();
    const label = this.renderer.labelPool.acquire();
    label.setBillboard(true);
    label.setText(text);
    label.position.set(0, 0, 0.4);
    label.setLineHeight(this.renderer.config.scene.transforms?.labelSize ?? DEFAULT_TF_LABEL_SIZE);
    label.visible = this.renderer.config.scene.transforms?.showLabel ?? true;
    label.setColor(this.labelForegroundColor, this.labelForegroundColor, this.labelForegroundColor);
    label.setBackgroundColor(
      this.labelBackgroundColor.r,
      this.labelBackgroundColor.g,
      this.labelBackgroundColor.b,
    );

    // Set the initial settings from default values merged with any user settings
    const userSettings = this.renderer.config.transforms[frameId] as
      | Partial<LayerSettingsTransform>
      | undefined;
    const settings = { ...DEFAULT_SETTINGS, ...userSettings };

    // Parent line
    const parentLine = new Line2(FrameAxes.LineGeometry(), this.lineMaterial);
    parentLine.castShadow = true;
    parentLine.receiveShadow = false;
    parentLine.userData.pickingMaterial = this.linePickingMaterial;
    parentLine.visible = false;

    // Three arrow axis
    const axis = new Axis(frameId, this.renderer);
    const axisScale = this.renderer.config.scene.transforms?.axisScale ?? DEFAULT_AXIS_SCALE;
    axis.scale.set(axisScale, axisScale, axisScale);

    // Create a scene graph object to hold the axis, a text label, and a line to
    // the parent frame
    const renderable = new FrameAxisRenderable(frameId, this.renderer, {
      receiveTime: 0n,
      messageTime: 0n,
      frameId,
      pose: makePose(),
      settingsPath: ["transforms", frameId],
      settings,
      axis,
      label,
      parentLine,
    });
    renderable.add(axis);
    renderable.add(label);
    renderable.add(parentLine);

    this.add(renderable);
    this.renderables.set(frameId, renderable);
  }

  static LineGeometry(): LineGeometry {
    if (!FrameAxes.lineGeometry) {
      FrameAxes.lineGeometry = new LineGeometry();
      FrameAxes.lineGeometry.setPositions([0, 0, 0, 1, 0, 0]);
    }
    return FrameAxes.lineGeometry;
  }
}

function buildSettingsFields(
  frame: CoordinateFrame | undefined,
  currentTime: bigint | undefined,
): SettingsTreeFields {
  let ageValue: string | undefined;
  let xyzValue: THREE.Vector3Tuple | undefined;
  let rpyValue: THREE.Vector3Tuple | undefined;
  const parentFrameId = frame?.parent()?.id;

  if (parentFrameId == undefined) {
    return { parent: { label: "Parent", input: "string", readonly: true, value: "<root>" } };
  }

  if (currentTime != undefined && frame) {
    if (frame.findClosestTransforms(tempLower, tempUpper, currentTime, MAX_DURATION)) {
      const [transformTime, transform] = tempUpper;
      ageValue =
        transformTime < currentTime ? formatShortDuration(currentTime - transformTime) : "0 ns";
      const p = transform.position() as THREE.Vector3Tuple;
      const q = transform.rotation() as THREE.Vector4Tuple;
      xyzValue = [round(p[0], 3), round(p[1], 3), round(p[2], 3)];
      tempQuaternion.set(q[0], q[1], q[2], q[3]);
      tempEuler.setFromQuaternion(tempQuaternion, "XYZ");
      rpyValue = [
        round(THREE.MathUtils.radToDeg(tempEuler.x), 3),
        round(THREE.MathUtils.radToDeg(tempEuler.y), 3),
        round(THREE.MathUtils.radToDeg(tempEuler.z), 3),
      ];
    }
  }

  return {
    parent: {
      label: "Parent",
      input: "string",
      readonly: true,
      value: parentFrameId,
    },
    age: {
      label: "Age",
      input: "string",
      readonly: true,
      value: ageValue,
    },
    xyz: {
      label: "Translation",
      input: "vec3",
      precision: 3,
      labels: ["X", "Y", "Z"],
      readonly: true,
      value: xyzValue,
    },
    rpy: {
      label: "Rotation",
      input: "vec3",
      precision: 3,
      labels: ["R", "P", "Y"],
      readonly: true,
      value: rpyValue,
    },
  };
}

const MS_TENTH_NS = BigInt(1e5);
const MS_NS = BigInt(1e6);
const SEC_NS = BigInt(1e9);
const MIN_NS = BigInt(6e10);
const HOUR_NS = BigInt(3.6e12);

function formatShortDuration(duration: Duration): string {
  const absDuration = abs(duration);
  if (absDuration < MS_TENTH_NS) {
    return `${duration} ns`;
  } else if (absDuration < SEC_NS) {
    return `${Number(duration / MS_NS).toFixed(1)} ms`;
  } else if (absDuration < MIN_NS) {
    return `${Number(duration / SEC_NS).toFixed(1)} s`;
  } else if (absDuration < HOUR_NS) {
    return `${Number(duration / MIN_NS).toFixed(1)} min`;
  } else {
    return `${Number(duration / HOUR_NS).toFixed(1)} hr`;
  }
}

function abs(x: bigint): bigint {
  return x < 0n ? -x : x;
}

function round(x: number, precision: number): number {
  return Number(x.toFixed(precision));
}
