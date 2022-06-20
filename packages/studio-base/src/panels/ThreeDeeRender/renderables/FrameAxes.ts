// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";

import { SettingsTreeAction } from "@foxglove/studio-base/components/SettingsTreeEditor/types";

import { MaterialCache, StandardColor } from "../MaterialCache";
import { BaseUserData, Renderable } from "../Renderable";
import { Renderer } from "../Renderer";
import { SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { arrowHeadSubdivisions, arrowShaftSubdivisions, DetailLevel } from "../lod";
import { BaseSettings } from "../settings";
import { makePose } from "../transforms";
import { linePickingMaterial, releaseLinePickingMaterial } from "./markers/materials";

export type LayerSettingsTransform = BaseSettings;

const SHAFT_LENGTH = 0.154;
const SHAFT_DIAMETER = 0.02;
const HEAD_LENGTH = 0.046;
const HEAD_DIAMETER = 0.05;

const RED_COLOR = new THREE.Color(0x9c3948).convertSRGBToLinear();
const GREEN_COLOR = new THREE.Color(0x88dd04).convertSRGBToLinear();
const BLUE_COLOR = new THREE.Color(0x2b90fb).convertSRGBToLinear();
const YELLOW_COLOR = new THREE.Color(0xffff00).convertSRGBToLinear();

const COLOR_WHITE = { r: 1, g: 1, b: 1, a: 1 };

const PI_2 = Math.PI / 2;

const PICKING_LINE_SIZE = 6;

const DEFAULT_SETTINGS: LayerSettingsTransform = {
  visible: true,
  frameLocked: true,
};

const tempMat4 = new THREE.Matrix4();
const tempVec = new THREE.Vector3();
const tempVecB = new THREE.Vector3();

export type FrameAxisUserData = BaseUserData & {
  settings: LayerSettingsTransform;
  shaftMesh: THREE.InstancedMesh;
  headMesh: THREE.InstancedMesh;
  label: THREE.Sprite;
  parentLine?: Line2;
};

export class FrameAxisRenderable extends Renderable<FrameAxisUserData> {
  override dispose(): void {
    releaseStandardMaterial(this.renderer.materialCache);
    this.userData.shaftMesh.dispose();
    this.userData.headMesh.dispose();
    this.renderer.labels.removeById(`tf:${this.userData.frameId}`);
    super.dispose();
  }
}

export class FrameAxes extends SceneExtension<FrameAxisRenderable> {
  private static shaftLod: DetailLevel | undefined;
  private static headLod: DetailLevel | undefined;
  private static shaftGeometry: THREE.CylinderGeometry | undefined;
  private static headGeometry: THREE.ConeGeometry | undefined;
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
  }

  override dispose(): void {
    this.renderer.off("transformTreeUpdated", this.handleTransformTreeUpdated);
    this.lineMaterial.dispose();
    releaseLinePickingMaterial(PICKING_LINE_SIZE, false, this.renderer.materialCache);
    super.dispose();
  }

  override settingsNodes(): SettingsTreeEntry[] {
    // Clear the transforms children so we can re-add them in the correct order
    this.renderer.settings.clearChildren(["transforms"]);

    const configTransforms = this.renderer.config.transforms;
    const handler = this.handleSettingsAction;
    const entries: SettingsTreeEntry[] = [];
    for (const { label, value: frameId } of this.renderer.coordinateFrameList) {
      const config = (configTransforms[frameId] ?? {}) as Partial<LayerSettingsTransform>;
      // TODO(jhurliman): readonly fields and icons for root vs non-root frames
      // const frame = this.renderer.transformTree.frame(frameId);
      // const isRoot = frame?.isRoot();

      // const fields: SettingsTreeFields = {};
      // const icon = isRoot === true ? "SouthEast" : isRoot === false ? "NorthWest" : undefined;

      entries.push({
        path: ["transforms", frameId],
        node: { label, visible: config.visible ?? true, handler },
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

    // Create three arrow shafts
    const arrowMaterial = standardMaterial(this.renderer.materialCache);
    const shaftGeometry = FrameAxes.ShaftGeometry(this.renderer.maxLod);
    const shaftInstances = new THREE.InstancedMesh(shaftGeometry, arrowMaterial, 3);
    shaftInstances.castShadow = true;
    shaftInstances.receiveShadow = true;

    // Set x, y, and z axis arrow shaft directions
    tempVec.set(SHAFT_LENGTH, SHAFT_DIAMETER, SHAFT_DIAMETER);
    shaftInstances.setMatrixAt(0, tempMat4.identity().scale(tempVec));
    shaftInstances.setMatrixAt(1, tempMat4.makeRotationZ(PI_2).scale(tempVec));
    shaftInstances.setMatrixAt(2, tempMat4.makeRotationY(-PI_2).scale(tempVec));
    shaftInstances.setColorAt(0, RED_COLOR);
    shaftInstances.setColorAt(1, GREEN_COLOR);
    shaftInstances.setColorAt(2, BLUE_COLOR);

    // Create three arrow heads
    const headGeometry = FrameAxes.HeadGeometry(this.renderer.maxLod);
    const headInstances = new THREE.InstancedMesh(headGeometry, arrowMaterial, 3);
    headInstances.castShadow = true;
    headInstances.receiveShadow = true;

    // Set x, y, and z axis arrow head directions
    tempVec.set(HEAD_LENGTH, HEAD_DIAMETER, HEAD_DIAMETER);
    tempMat4.identity().scale(tempVec).setPosition(SHAFT_LENGTH, 0, 0);
    headInstances.setMatrixAt(0, tempMat4);
    tempMat4.makeRotationZ(PI_2).scale(tempVec).setPosition(0, SHAFT_LENGTH, 0);
    headInstances.setMatrixAt(1, tempMat4);
    tempMat4.makeRotationY(-PI_2).scale(tempVec).setPosition(0, 0, SHAFT_LENGTH);
    headInstances.setMatrixAt(2, tempMat4);
    headInstances.setColorAt(0, RED_COLOR);
    headInstances.setColorAt(1, GREEN_COLOR);
    headInstances.setColorAt(2, BLUE_COLOR);

    const frame = this.renderer.transformTree.frame(frameId);
    if (!frame) {
      throw new Error(`CoordinateFrame "${frameId}" was not created`);
    }

    const frameDisplayName =
      frame.id === "" || frame.id.startsWith(" ") || frame.id.endsWith(" ")
        ? `"${frame.id}"`
        : frame.id;

    // Text label
    const label = this.renderer.labels.setLabel(`tf:${frameId}`, { text: frameDisplayName });
    label.position.set(0, 0, 0.4);

    // Set the initial settings from default values merged with any user settings
    const userSettings = this.renderer.config.transforms[frameId] as
      | Partial<LayerSettingsTransform>
      | undefined;
    const settings = { ...DEFAULT_SETTINGS, ...userSettings };

    // Create a scene graph object to hold the three arrows, a text label, and a
    // line to the parent frame if it exists
    const renderable = new FrameAxisRenderable(frameId, this.renderer, {
      receiveTime: 0n,
      messageTime: 0n,
      frameId,
      pose: makePose(),
      settingsPath: ["transforms", frameId],
      settings,
      shaftMesh: shaftInstances,
      headMesh: headInstances,
      label,
      parentLine: undefined,
    });

    renderable.add(shaftInstances);
    renderable.add(headInstances);
    renderable.add(label);

    // Check if this frame's parent exists
    const parentFrame = frame.parent();
    if (parentFrame) {
      const parentRenderable = this.renderables.get(parentFrame.id);
      if (parentRenderable) {
        this._addChildParentLine(renderable);
      }
    }

    // Find all children of this frame
    for (const curFrame of this.renderer.transformTree.frames().values()) {
      if (curFrame.parent() === frame) {
        const curRenderable = this.renderables.get(curFrame.id);
        if (curRenderable) {
          this._addChildParentLine(curRenderable);
        }
      }
    }

    this.add(renderable);
    this.renderables.set(frameId, renderable);
  }

  private _addChildParentLine(renderable: FrameAxisRenderable): void {
    if (renderable.userData.parentLine) {
      renderable.remove(renderable.userData.parentLine);
    }
    const line = new Line2(FrameAxes.LineGeometry(), this.lineMaterial);
    line.castShadow = true;
    line.receiveShadow = false;
    line.userData.pickingMaterial = this.linePickingMaterial;

    renderable.add(line);
    renderable.userData.parentLine = line;
  }

  static ShaftGeometry(lod: DetailLevel): THREE.CylinderGeometry {
    if (!FrameAxes.shaftGeometry || lod !== FrameAxes.shaftLod) {
      const subdivs = arrowShaftSubdivisions(lod);
      FrameAxes.shaftGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, subdivs, 1, false);
      FrameAxes.shaftGeometry.rotateZ(-PI_2);
      FrameAxes.shaftGeometry.translate(0.5, 0, 0);
      FrameAxes.shaftGeometry.computeBoundingSphere();
      FrameAxes.shaftLod = lod;
    }
    return FrameAxes.shaftGeometry;
  }

  static HeadGeometry(lod: DetailLevel): THREE.ConeGeometry {
    if (!FrameAxes.headGeometry || lod !== FrameAxes.headLod) {
      const subdivs = arrowHeadSubdivisions(lod);
      FrameAxes.headGeometry = new THREE.ConeGeometry(0.5, 1, subdivs, 1, false);
      FrameAxes.headGeometry.rotateZ(-PI_2);
      FrameAxes.headGeometry.translate(0.5, 0, 0);
      FrameAxes.headGeometry.computeBoundingSphere();
      FrameAxes.headLod = lod;
    }
    return FrameAxes.headGeometry;
  }

  static LineGeometry(): LineGeometry {
    if (!FrameAxes.lineGeometry) {
      FrameAxes.lineGeometry = new LineGeometry();
      FrameAxes.lineGeometry.setPositions([0, 0, 0, 1, 0, 0]);
    }
    return FrameAxes.lineGeometry;
  }
}

function standardMaterial(materialCache: MaterialCache): THREE.MeshStandardMaterial {
  return materialCache.acquire(
    StandardColor.id(COLOR_WHITE),
    () => StandardColor.create(COLOR_WHITE),
    StandardColor.dispose,
  );
}

function releaseStandardMaterial(materialCache: MaterialCache): void {
  materialCache.release(StandardColor.id(COLOR_WHITE));
}
