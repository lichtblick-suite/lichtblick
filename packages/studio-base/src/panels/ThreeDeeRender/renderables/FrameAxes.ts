// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";

import { SettingsTreeAction, SettingsTreeFields } from "@foxglove/studio";

import { Renderer } from "../Renderer";
import { SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { BaseSettings } from "../settings";
import { Duration, Transform, makePose, CoordinateFrame, MAX_DURATION } from "../transforms";
import { AxisRenderable } from "./AxisRenderable";
import { linePickingMaterial, releaseLinePickingMaterial } from "./markers/materials";

export type LayerSettingsTransform = BaseSettings;

const YELLOW_COLOR = new THREE.Color(0xffff00).convertSRGBToLinear();
const PICKING_LINE_SIZE = 6;
const PI_2 = Math.PI / 2;

const DEFAULT_SETTINGS: LayerSettingsTransform = {
  visible: true,
  frameLocked: true,
};

const tempVec = new THREE.Vector3();
const tempVecB = new THREE.Vector3();
const tempLower: [Duration, Transform] = [0n, Transform.Identity()];
const tempUpper: [Duration, Transform] = [0n, Transform.Identity()];
const tempQuaternion = new THREE.Quaternion();
const tempEuler = new THREE.Euler();

export class FrameAxes extends SceneExtension<AxisRenderable> {
  private static lineGeometry: LineGeometry | undefined;

  lineMaterial: LineMaterial;
  linePickingMaterial: THREE.ShaderMaterial;

  constructor(renderer: Renderer) {
    super("foxglove.FrameAxes", renderer);

    this.lineMaterial = new LineMaterial({ linewidth: 2 });
    this.lineMaterial.color = YELLOW_COLOR;

    this.linePickingMaterial = linePickingMaterial(
      PICKING_LINE_SIZE,
      false,
      renderer.materialCache,
    );

    renderer.on("transformTreeUpdated", this.handleTransformTreeUpdated);
    renderer.on("startFrame", () => this.updateSettingsTree());
  }

  override dispose(): void {
    this.renderer.off("transformTreeUpdated", this.handleTransformTreeUpdated);
    this.lineMaterial.dispose();
    releaseLinePickingMaterial(PICKING_LINE_SIZE, false, this.renderer.materialCache);
    super.dispose();
  }

  override settingsNodes(): SettingsTreeEntry[] {
    const configTransforms = this.renderer.config.transforms;
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
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
      if (line) {
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
  }

  handleSettingsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;
    if (action.action !== "update" || path.length !== 3) {
      return;
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
    const displayName = frame.displayName();

    // Text label
    const label = this.renderer.labels.setLabel(`tf:${frameId}`, { text: displayName });
    label.position.set(0, 0, 0.4);

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

    // Create a scene graph object to hold the three arrows, a text label, and a
    // line to the parent frame
    const renderable = new AxisRenderable(frameId, this.renderer, {
      receiveTime: 0n,
      messageTime: 0n,
      frameId,
      pose: makePose(),
      settingsPath: ["transforms", frameId],
      settings,
      label,
      parentLine,
    });

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
