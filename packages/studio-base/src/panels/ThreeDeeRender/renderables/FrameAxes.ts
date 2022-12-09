// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable } from "immer";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";

import { SettingsTreeAction, SettingsTreeChildren, SettingsTreeFields } from "@foxglove/studio";
import type { RosValue } from "@foxglove/studio-base/players/types";
import { Label } from "@foxglove/three-text";

import { BaseUserData, Renderable } from "../Renderable";
import { Renderer, RendererConfig } from "../Renderer";
import { SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { getLuminance, stringToRgb } from "../color";
import { BaseSettings, fieldSize, PRECISION_DEGREES, PRECISION_DISTANCE } from "../settings";
import { Duration, Transform, makePose, CoordinateFrame, MAX_DURATION } from "../transforms";
import { Axis, AXIS_LENGTH } from "./Axis";
import {
  DEFAULT_AXIS_SCALE,
  DEFAULT_LABEL_SCALE_FACTOR,
  DEFAULT_LINE_COLOR_STR,
  DEFAULT_LINE_WIDTH_PX,
  DEFAULT_TF_LABEL_SIZE,
} from "./CoreSettings";
import { makeLinePickingMaterial } from "./markers/materials";

export type LayerSettingsTransform = BaseSettings & {
  xyzOffset: Readonly<[number | undefined, number | undefined, number | undefined]>;
  rpyOffset: Readonly<[number | undefined, number | undefined, number | undefined]>;
};

const PICKING_LINE_SIZE = 6;
const PI_2 = Math.PI / 2;

const DEFAULT_EDITABLE = false;

const DEFAULT_SETTINGS: LayerSettingsTransform = {
  visible: true,
  frameLocked: true,
  xyzOffset: [0, 0, 0],
  rpyOffset: [0, 0, 0],
};

export type FrameAxisUserData = BaseUserData & {
  axis: Axis;
  label: Label;
  parentLine: Line2;
};

class FrameAxisRenderable extends Renderable<FrameAxisUserData> {
  public override dispose(): void {
    this.renderer.labelPool.release(this.userData.label);
    super.dispose();
  }

  public override details(): Record<string, RosValue> {
    const frame = this.renderer.transformTree.frame(this.userData.frameId);
    const parent = frame?.parent();
    const fixed = frame?.root();

    return {
      child_frame_id: frame?.displayName() ?? "<unknown>",
      parent_frame_id: parent?.displayName() ?? "<unknown>",
      fixed_frame_id: fixed?.displayName() ?? "<unknown>",
    };
  }
}

const tempVec = new THREE.Vector3();
const tempVecB = new THREE.Vector3();
const tempLower: [Duration, Transform] = [0n, Transform.Identity()];
const tempUpper: [Duration, Transform] = [0n, Transform.Identity()];
const tempQuaternion = new THREE.Quaternion();
const tempEuler = new THREE.Euler();
const tempTfPath: [string, string] = ["transforms", ""];

export class FrameAxes extends SceneExtension<FrameAxisRenderable> {
  private lineMaterial: LineMaterial;
  private linePickingMaterial: THREE.ShaderMaterial;

  private labelForegroundColor = 1;
  private labelBackgroundColor = new THREE.Color();
  private lineGeometry: LineGeometry;

  public constructor(renderer: Renderer) {
    super("foxglove.FrameAxes", renderer);

    const linewidth = this.renderer.config.scene.transforms?.lineWidth ?? DEFAULT_LINE_WIDTH_PX;
    const color = stringToRgb(
      new THREE.Color(),
      this.renderer.config.scene.transforms?.lineColor ?? DEFAULT_LINE_COLOR_STR,
    );
    this.lineMaterial = new LineMaterial({ linewidth });
    this.lineMaterial.color = color;

    const options = { resolution: renderer.input.canvasSize, worldUnits: false };

    this.lineGeometry = this.renderer.sharedGeometry.getGeometry(
      this.constructor.name,
      createLineGeometry,
    );

    this.linePickingMaterial = makeLinePickingMaterial(PICKING_LINE_SIZE, options);

    renderer.on("transformTreeUpdated", this.handleTransformTreeUpdated);
  }

  public override dispose(): void {
    this.renderer.off("transformTreeUpdated", this.handleTransformTreeUpdated);
    this.lineMaterial.dispose();
    this.linePickingMaterial.dispose();
    super.dispose();
  }

  public override removeAllRenderables(): void {
    // Don't destroy frame axis renderables on clear() since `renderer.transformTree`
    // is left untouched
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const config = this.renderer.config;
    const configTransforms = config.transforms;
    const handler = this.handleSettingsAction;
    const frameCount = this.renderer.coordinateFrameList.length;
    const children: SettingsTreeChildren = {
      settings: {
        label: "Settings",
        icon: "Settings",
        defaultExpansionState: "collapsed",
        order: 0,
        fields: {
          editable: {
            label: "Editable",
            input: "boolean",
            value: config.scene.transforms?.editable ?? DEFAULT_EDITABLE,
          },
          showLabel: {
            label: "Labels",
            input: "boolean",
            value: config.scene.transforms?.showLabel ?? true,
          },
          ...((config.scene.transforms?.showLabel ?? true) && {
            labelSize: {
              label: "Label size",
              input: "number",
              min: 0,
              step: 0.01,
              precision: 2,
              placeholder: String(DEFAULT_TF_LABEL_SIZE),
              value: config.scene.transforms?.labelSize,
            },
          }),
          axisScale: fieldSize(
            "Axis scale",
            config.scene.transforms?.axisScale,
            DEFAULT_AXIS_SCALE,
          ),
          lineWidth: {
            label: "Line width",
            input: "number",
            min: 0,
            step: 0.5,
            precision: 1,
            value: config.scene.transforms?.lineWidth,
            placeholder: String(DEFAULT_LINE_WIDTH_PX),
          },
          lineColor: {
            label: "Line color",
            input: "rgb",
            value: config.scene.transforms?.lineColor ?? DEFAULT_LINE_COLOR_STR,
          },
          // Disabled until we can efficiently preload transforms
          // enablePreloading: {
          //   label: "Enable preloading",
          //   input: "boolean",
          //   value: config.scene.transforms?.enablePreloading ?? true,
          // },
        },
      },
    };

    let order = 1;
    for (const { label, value: frameId } of this.renderer.coordinateFrameList) {
      const frameKey = `frame:${frameId}`;
      const tfConfig = (configTransforms[frameKey] ?? {}) as Partial<LayerSettingsTransform>;
      const frame = this.renderer.transformTree.frame(frameId);
      const fields = buildSettingsFields(frame, this.renderer.currentTime, config);
      tempTfPath[1] = frameKey;
      children[frameKey] = {
        label,
        fields,
        visible: tfConfig.visible ?? true,
        order: order++,
        defaultExpansionState: "collapsed",
        error: this.renderer.settings.errors.errors.errorAtPath(tempTfPath),
      };
    }

    return [
      {
        path: ["transforms"],
        node: {
          label: `Transforms${frameCount > 0 ? ` (${frameCount})` : ""}`,
          actions: [
            { id: "show-all", type: "action", label: "Show All" },
            { id: "hide-all", type: "action", label: "Hide All" },
          ],
          handler,
          children,
        },
      },
    ];
  }

  public override startFrame(
    currentTime: bigint,
    renderFrameId: string,
    fixedFrameId: string,
  ): void {
    // Keep the material's `resolution` uniform in sync with the actual canvas size
    this.lineMaterial.resolution = this.renderer.input.canvasSize;

    // Update all the transforms settings nodes each frame since they contain
    // fields that change when currentTime changes
    this.updateSettingsTree();

    super.startFrame(currentTime, renderFrameId, fixedFrameId);

    // Compute the label offset based on the axis length and label size. We want the label
    // to float a little above the up axis arrow, proportional to the height of the label
    const axisScale = this.renderer.config.scene.transforms?.axisScale ?? DEFAULT_AXIS_SCALE;
    const axisLength = AXIS_LENGTH * axisScale;
    const labelSize = this.renderer.config.scene.transforms?.labelSize ?? DEFAULT_TF_LABEL_SIZE;
    const labelScale = this.renderer.config.scene.labelScaleFactor ?? DEFAULT_LABEL_SCALE_FACTOR;
    const labelOffsetZ = axisLength + labelSize * labelScale * 1.5;

    // Update the lines and labels between coordinate frames
    for (const renderable of this.renderables.values()) {
      const label = renderable.userData.label;
      const line = renderable.userData.parentLine;
      const childFrame = this.renderer.transformTree.frame(renderable.userData.frameId);
      const parentFrame = childFrame?.parent();
      // NOTE: tempVecB should not be used until the label uses it below
      const worldPosition = tempVecB;
      renderable.getWorldPosition(worldPosition);
      // Lines require a parent renderable because they draw a line from the parent
      // frame origin to the child frame origin
      line.visible = false;
      if (parentFrame) {
        const parentRenderable = this.renderables.get(parentFrame.id);
        if (parentRenderable?.visible === true) {
          const parentWorldPosition = tempVec;
          parentRenderable.getWorldPosition(parentWorldPosition);
          const dist = parentWorldPosition.distanceTo(worldPosition);
          line.lookAt(parentWorldPosition);
          line.rotateY(-PI_2);
          line.scale.set(dist, 1, 1);
          line.visible = true;
        }
      }

      // Add the label offset in "world" coordinates (in the render frame)
      worldPosition.z += labelOffsetZ;
      // Transform worldPosition back to the local coordinate frame of the
      // renderable, which the label is a child of
      renderable.worldToLocal(worldPosition);
      label.position.set(worldPosition.x, worldPosition.y, worldPosition.z);
    }
  }

  public override setColorScheme(
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
  private setLabelVisible(visible: boolean): void {
    for (const renderable of this.renderables.values()) {
      renderable.userData.label.visible = visible;
    }
  }

  private setLabelSize(size: number): void {
    for (const renderable of this.renderables.values()) {
      renderable.userData.label.setLineHeight(size);
    }
  }

  private setAxisScale(scale: number): void {
    for (const renderable of this.renderables.values()) {
      renderable.userData.axis.scale.set(scale, scale, scale);
    }
  }

  private setLineWidth(width: number): void {
    this.lineMaterial.linewidth = width;
  }

  private setLineColor(color: string): void {
    stringToRgb(this.lineMaterial.color, color);
  }

  public override handleSettingsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;

    // eslint-disable-next-line @foxglove/no-boolean-parameters
    const toggleFrameVisibility = (value: boolean) => {
      for (const renderable of this.renderables.values()) {
        renderable.userData.settings.visible = value;
      }

      this.renderer.updateConfig((draft) => {
        for (const frameId of this.renderables.keys()) {
          const frameKeySanitized = frameId === "settings" ? "$settings" : `frame:${frameId}`;
          draft.transforms[frameKeySanitized] ??= {};
          draft.transforms[frameKeySanitized]!.visible = value;
        }
      });

      this.updateSettingsTree();
    };

    if (action.action === "perform-node-action") {
      if (action.payload.id === "show-all") {
        // Show all frames
        toggleFrameVisibility(true);
      } else if (action.payload.id === "hide-all") {
        // Hide all frames
        toggleFrameVisibility(false);
      }
      return;
    }

    if (path.length !== 3) {
      return; // Doesn't match the pattern of ["transforms", "settings" | `frame:${frameId}`, field]
    }

    if (path[1] === "settings") {
      const setting = path[2]!;
      const value = action.payload.value;

      this.saveSetting(["scene", "transforms", setting], value);

      if (setting === "editable") {
        this._updateFrameAxes();
      } else if (setting === "showLabel") {
        const showLabel = value as boolean | undefined;
        this.setLabelVisible(showLabel ?? true);
      } else if (setting === "labelSize") {
        const labelSize = value as number | undefined;
        this.setLabelSize(labelSize ?? DEFAULT_TF_LABEL_SIZE);
      } else if (setting === "axisScale") {
        const axisScale = value as number | undefined;
        this.setAxisScale(axisScale ?? DEFAULT_AXIS_SCALE);
      } else if (setting === "lineWidth") {
        const lineWidth = value as number | undefined;
        this.setLineWidth(lineWidth ?? DEFAULT_LINE_WIDTH_PX);
      } else if (setting === "lineColor") {
        const lineColor = value as string | undefined;
        this.setLineColor(lineColor ?? DEFAULT_LINE_COLOR_STR);
      }
    } else {
      this.saveSetting(path, action.payload.value);

      // Update the renderable
      const frameKey = path[1]!;
      const frameId = frameKey.replace(/^frame:/, "");
      const renderable = this.renderables.get(frameId);
      if (renderable) {
        const settings = this.renderer.config.transforms[frameKey] as
          | Partial<LayerSettingsTransform>
          | undefined;
        renderable.userData.settings = { ...DEFAULT_SETTINGS, ...settings };

        this._updateFrameAxis(renderable);
      }
    }
  };

  private handleTransformTreeUpdated = (): void => {
    for (const frameId of this.renderer.transformTree.frames().keys()) {
      this._addFrameAxis(frameId);
    }
    this.updateSettingsTree();
  };

  private _addFrameAxis(frameId: string): void {
    if (this.renderables.has(frameId)) {
      return;
    }

    const config = this.renderer.config;
    const frame = this.renderer.transformTree.frame(frameId);
    if (!frame) {
      throw new Error(`CoordinateFrame "${frameId}" was not created`);
    }

    // Text label
    const text = frame.displayName();
    const label = this.renderer.labelPool.acquire();
    label.setBillboard(true);
    label.setText(text);
    label.setLineHeight(config.scene.transforms?.labelSize ?? DEFAULT_TF_LABEL_SIZE);
    label.visible = config.scene.transforms?.showLabel ?? true;
    label.setColor(this.labelForegroundColor, this.labelForegroundColor, this.labelForegroundColor);
    label.setBackgroundColor(
      this.labelBackgroundColor.r,
      this.labelBackgroundColor.g,
      this.labelBackgroundColor.b,
    );

    // Set the initial settings from default values merged with any user settings
    const frameKey = `frame:${frameId}`;
    const userSettings = config.transforms[frameKey] as Partial<LayerSettingsTransform> | undefined;
    const settings = { ...DEFAULT_SETTINGS, ...userSettings };

    // Parent line
    const parentLine = new Line2(this.lineGeometry, this.lineMaterial);
    parentLine.castShadow = true;
    parentLine.receiveShadow = false;
    parentLine.userData.pickingMaterial = this.linePickingMaterial;
    parentLine.visible = false;

    // Three arrow axis
    const axis = new Axis(frameId, this.renderer);
    const axisScale = config.scene.transforms?.axisScale ?? DEFAULT_AXIS_SCALE;
    axis.scale.set(axisScale, axisScale, axisScale);

    // Create a scene graph object to hold the axis, a text label, and a line to
    // the parent frame
    const renderable = new FrameAxisRenderable(frameId, this.renderer, {
      receiveTime: 0n,
      messageTime: 0n,
      frameId,
      pose: makePose(),
      settingsPath: ["transforms", frameKey],
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

    this._updateFrameAxis(renderable);
  }

  private _updateFrameAxes(): void {
    for (const renderable of this.renderables.values()) {
      this._updateFrameAxis(renderable);
    }
  }

  private _updateFrameAxis(renderable: FrameAxisRenderable): void {
    const frame = this.renderer.transformTree.getOrCreateFrame(renderable.userData.frameId);

    // Check if TF editing is disabled
    const editable = this.renderer.config.scene.transforms?.editable ?? DEFAULT_EDITABLE;
    if (!editable) {
      frame.offsetPosition = undefined;
      frame.offsetEulerDegrees = undefined;
      return;
    }

    const frameKey = `frame:${renderable.userData.frameId}`;
    frame.offsetPosition = getOffset(this.renderer.config.transforms[frameKey]?.xyzOffset);
    frame.offsetEulerDegrees = getOffset(this.renderer.config.transforms[frameKey]?.rpyOffset);
  }
}
function createLineGeometry(): LineGeometry {
  const lineGeometry = new LineGeometry();
  lineGeometry.setPositions([0, 0, 0, 1, 0, 0]);
  return lineGeometry;
}

function buildSettingsFields(
  frame: CoordinateFrame | undefined,
  currentTime: bigint | undefined,
  config: Immutable<RendererConfig>,
): SettingsTreeFields {
  const frameKey = frame ? `frame:${frame.id}` : "";
  const parentFrameId = frame?.parent()?.id;

  if (parentFrameId == undefined) {
    return { parent: { label: "Parent", input: "string", readonly: true, value: "<root>" } };
  }

  const historySizeValue = String(frame?.transformsSize() ?? 0);
  let ageValue: string | undefined;
  let xyzValue: THREE.Vector3Tuple | undefined;
  let rpyValue: THREE.Vector3Tuple | undefined;

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

  const fields: SettingsTreeFields = {
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
    historySize: {
      label: "History Size",
      input: "string",
      readonly: true,
      value: historySizeValue,
    },
    xyz: {
      label: "Translation",
      input: "vec3",
      precision: PRECISION_DISTANCE,
      labels: ["X", "Y", "Z"],
      readonly: true,
      value: xyzValue,
    },
    rpy: {
      label: "Rotation",
      input: "vec3",
      precision: PRECISION_DEGREES,
      labels: ["R", "P", "Y"],
      readonly: true,
      value: rpyValue,
    },
  };

  if (config.scene.transforms?.editable ?? DEFAULT_EDITABLE) {
    let xyzOffsetValue = config.transforms[frameKey]?.xyzOffset as THREE.Vector3Tuple | undefined;
    let rpyOffsetValue = config.transforms[frameKey]?.rpyOffset as THREE.Vector3Tuple | undefined;

    if (xyzOffsetValue && vec3IsZero(xyzOffsetValue)) {
      xyzOffsetValue = undefined;
    }
    if (rpyOffsetValue && vec3IsZero(rpyOffsetValue)) {
      rpyOffsetValue = undefined;
    }

    fields.xyzOffset = {
      label: "Translation Offset",
      input: "vec3",
      precision: PRECISION_DISTANCE,
      step: 0.1,
      labels: ["X", "Y", "Z"],
      value: xyzOffsetValue,
    };
    fields.rpyOffset = {
      label: "Rotation Offset",
      input: "vec3",
      precision: PRECISION_DEGREES,
      step: 1,
      min: -180,
      max: 180,
      labels: ["R", "P", "Y"],
      value: rpyOffsetValue,
    };
  }

  return fields;
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

function vec3IsZero(v: THREE.Vector3Tuple, eps = 1e-6): boolean {
  return Math.abs(v[0]) < eps && Math.abs(v[1]) < eps && Math.abs(v[2]) < eps;
}

function getOffset(
  maybeOffset: Readonly<[number | undefined, number | undefined, number | undefined]> | undefined,
): THREE.Vector3Tuple | undefined {
  if (!maybeOffset) {
    return undefined;
  }
  const [x = 0, y = 0, z = 0] = maybeOffset;
  if (x === 0 && y === 0 && z === 0) {
    return undefined;
  }
  return [x, y, z];
}
