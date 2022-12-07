// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";
import { ArrowPrimitive, SceneEntity } from "@foxglove/schemas";
import { emptyPose } from "@foxglove/studio-base/util/Pose";

import type { Renderer } from "../../Renderer";
import { makeRgba, rgbToThreeColor, stringToRgba } from "../../color";
import { LayerSettingsEntity } from "../SceneEntities";
import { MeshStandardMaterialWithInstanceOpacity } from "../materials/MeshStandardMaterialWithInstanceOpacity";
import { RenderablePrimitive } from "./RenderablePrimitive";

const tempColor = new THREE.Color();
const tempVec3 = new THREE.Vector3();
const tempVec3_2 = new THREE.Vector3();
const tempMat4 = new THREE.Matrix4();
const tempQuat = new THREE.Quaternion();
const tempRgba = makeRgba();

export class RenderableArrows extends RenderablePrimitive {
  // Each needs its own geometries because we attach additional custom attributes to them.
  // so we will need to clone or copy when assigning from shared geometry
  private shaftGeometry: THREE.CylinderGeometry;
  private headGeometry: THREE.ConeGeometry;
  private shaftOutlineGeometry: THREE.InstancedBufferGeometry;
  private headOutlineGeometry: THREE.InstancedBufferGeometry;

  private shaftMesh: THREE.InstancedMesh<
    THREE.CylinderGeometry,
    MeshStandardMaterialWithInstanceOpacity
  >;
  private headMesh: THREE.InstancedMesh<
    THREE.ConeGeometry,
    MeshStandardMaterialWithInstanceOpacity
  >;
  private instanceOpacity: THREE.InstancedBufferAttribute;
  private material = new MeshStandardMaterialWithInstanceOpacity({
    metalness: 0,
    roughness: 1,
    dithering: true,
  });

  /**
   * The initial count passed to `mesh`'s constructor, i.e. the maximum number of instances it can
   * render before we need to create a new mesh object
   */
  private maxInstances: number;

  private shaftOutline: THREE.LineSegments;
  private headOutline: THREE.LineSegments;

  public constructor(renderer: Renderer) {
    super("", renderer, {
      receiveTime: -1n,
      messageTime: -1n,
      frameId: "",
      pose: emptyPose(),
      settings: { visible: true, color: undefined },
      settingsPath: [],
      entity: undefined,
    });

    this.maxInstances = 16;
    this.instanceOpacity = new THREE.InstancedBufferAttribute(
      new Float32Array(this.maxInstances),
      1,
    );

    this.shaftGeometry = renderer.sharedGeometry
      .getGeometry(`${this.constructor.name}-shaft`, createShaftGeometry)
      .clone() as THREE.CylinderGeometry;
    this.shaftGeometry.setAttribute("instanceOpacity", this.instanceOpacity);
    this.shaftMesh = new THREE.InstancedMesh(this.shaftGeometry, this.material, this.maxInstances);
    this.shaftMesh.count = 0;
    this.add(this.shaftMesh);

    this.headGeometry = renderer.sharedGeometry
      .getGeometry(`${this.constructor.name}-head`, createHeadGeometry)
      .clone() as THREE.ConeGeometry;
    this.headGeometry.setAttribute("instanceOpacity", this.instanceOpacity);
    this.headMesh = new THREE.InstancedMesh(this.headGeometry, this.material, this.maxInstances);
    this.headMesh.count = 0;
    this.add(this.headMesh);

    const shaftEdgesGeometry = renderer.sharedGeometry.getGeometry(
      `${this.constructor.name}-shaftedges`,
      () => createShaftEdgesGeometry(this.shaftGeometry),
    );
    this.shaftOutlineGeometry = new THREE.InstancedBufferGeometry().copy(shaftEdgesGeometry);
    this.shaftOutlineGeometry.setAttribute("instanceMatrix", this.shaftMesh.instanceMatrix);
    this.shaftOutline = new THREE.LineSegments(
      this.shaftOutlineGeometry,
      renderer.instancedOutlineMaterial,
    );
    this.shaftOutline.frustumCulled = false;
    this.shaftOutline.userData.picking = false;
    this.add(this.shaftOutline);

    const headEdgesGeometry = renderer.sharedGeometry.getGeometry(
      `${this.constructor.name}-headedges`,
      () => createHeadEdgesGeometry(this.headGeometry),
    );
    this.headOutlineGeometry = new THREE.InstancedBufferGeometry().copy(headEdgesGeometry);
    this.headOutlineGeometry.setAttribute("instanceMatrix", this.headMesh.instanceMatrix);
    this.headOutline = new THREE.LineSegments(
      this.headOutlineGeometry,
      renderer.instancedOutlineMaterial,
    );
    this.headOutline.frustumCulled = false;
    this.headOutline.userData.picking = false;
    this.add(this.headOutline);
  }

  private _ensureCapacity(numArrows: number) {
    if (numArrows > this.maxInstances) {
      const newCapacity = Math.ceil(numArrows * 1.5) + 16;
      this.maxInstances = newCapacity;

      this.instanceOpacity = new THREE.InstancedBufferAttribute(
        new Float32Array(this.maxInstances),
        1,
      );

      this.shaftMesh.removeFromParent();
      this.shaftMesh.dispose();
      this.shaftMesh = new THREE.InstancedMesh(
        this.shaftGeometry,
        this.material,
        this.maxInstances,
      );
      this.shaftGeometry.setAttribute("instanceOpacity", this.instanceOpacity);
      this.add(this.shaftMesh);

      this.headMesh.removeFromParent();
      this.headMesh.dispose();
      this.headMesh = new THREE.InstancedMesh(this.headGeometry, this.material, this.maxInstances);
      this.headGeometry.setAttribute("instanceOpacity", this.instanceOpacity);
      this.add(this.headMesh);

      // THREE.js doesn't correctly recompute the new max instance count when dynamically
      // reassigning the attribute of InstancedBufferGeometry, so we just create a new geometry

      this.shaftOutlineGeometry.dispose();
      const shaftEdgesGeometry = this.renderer.sharedGeometry.getGeometry(
        `${this.constructor.name}-shaftedges`,
        () => createShaftEdgesGeometry(this.shaftGeometry),
      );
      this.shaftOutlineGeometry = new THREE.InstancedBufferGeometry().copy(shaftEdgesGeometry);
      this.shaftOutlineGeometry.instanceCount = newCapacity;
      this.shaftOutlineGeometry.setAttribute("instanceMatrix", this.shaftMesh.instanceMatrix);
      this.shaftOutline.geometry = this.shaftOutlineGeometry;

      this.headOutlineGeometry.dispose();
      const headEdgesGeometry = this.renderer.sharedGeometry.getGeometry(
        `${this.constructor.name}-headedges`,
        () => createHeadEdgesGeometry(this.headGeometry),
      );
      this.headOutlineGeometry = new THREE.InstancedBufferGeometry().copy(headEdgesGeometry);
      this.headOutlineGeometry.instanceCount = newCapacity;
      this.headOutlineGeometry.setAttribute("instanceMatrix", this.headMesh.instanceMatrix);
      this.headOutline.geometry = this.headOutlineGeometry;
    }
  }

  private _updateMesh(arrows: ArrowPrimitive[]) {
    let isTransparent = false;

    this._ensureCapacity(arrows.length);

    const overrideColor = this.userData.settings.color
      ? stringToRgba(tempRgba, this.userData.settings.color)
      : undefined;

    let i = 0;
    for (const arrow of arrows) {
      const color = overrideColor ?? arrow.color;
      if (color.a < 1) {
        isTransparent = true;
      }
      this.shaftMesh.setColorAt(i, rgbToThreeColor(tempColor, color));
      this.headMesh.setColorAt(i, rgbToThreeColor(tempColor, color));
      this.instanceOpacity.setX(i, color.a);
      tempQuat.set(
        arrow.pose.orientation.x,
        arrow.pose.orientation.y,
        arrow.pose.orientation.z,
        arrow.pose.orientation.w,
      );
      this.shaftMesh.setMatrixAt(
        i,
        tempMat4.compose(
          tempVec3.set(arrow.pose.position.x, arrow.pose.position.y, arrow.pose.position.z),
          tempQuat,
          tempVec3_2.set(arrow.shaft_length, arrow.shaft_diameter, arrow.shaft_diameter),
        ),
      );

      // offset head position by shaft length in direction of arrow pose
      tempVec3.add(tempVec3_2.set(arrow.shaft_length, 0, 0).applyQuaternion(tempQuat));

      this.headMesh.setMatrixAt(
        i,
        tempMat4.compose(
          tempVec3,
          tempQuat,
          tempVec3_2.set(arrow.head_length, arrow.head_diameter, arrow.head_diameter),
        ),
      );
      i++;
    }

    if (this.material.transparent !== isTransparent) {
      this.material.transparent = isTransparent;
      this.material.depthWrite = !isTransparent;
      this.material.needsUpdate = true;
    }

    if (this.shaftMesh.count === 0 && arrows.length > 0) {
      // needed to make colors work: https://discourse.threejs.org/t/instancedmesh-color-doesnt-work-when-initial-count-is-0/41355
      this.material.needsUpdate = true;
    }
    this.shaftMesh.count = arrows.length;
    this.headMesh.count = arrows.length;
    this.shaftOutlineGeometry.instanceCount = arrows.length;
    this.headOutlineGeometry.instanceCount = arrows.length;
    this.shaftMesh.instanceMatrix.needsUpdate = true;
    this.headMesh.instanceMatrix.needsUpdate = true;
    this.instanceOpacity.needsUpdate = true;

    // may be null if we were initialized with count 0 and still have 0 primitives
    if (this.shaftMesh.instanceColor) {
      this.shaftMesh.instanceColor.needsUpdate = true;
    }
    if (this.headMesh.instanceColor) {
      this.headMesh.instanceColor.needsUpdate = true;
    }
  }

  public override dispose(): void {
    this.material.dispose();
    this.shaftMesh.dispose();
    this.headMesh.dispose();
    this.shaftGeometry.dispose();
    this.headGeometry.dispose();
    this.shaftOutlineGeometry.dispose();
    this.headOutlineGeometry.dispose();
  }

  public override update(
    entity: SceneEntity | undefined,
    settings: LayerSettingsEntity,
    receiveTime: bigint,
  ): void {
    this.userData.entity = entity;
    this.userData.settings = settings;
    this.userData.receiveTime = receiveTime;
    if (entity) {
      const lifetimeNs = toNanoSec(entity.lifetime);
      this.userData.expiresAt = lifetimeNs === 0n ? undefined : receiveTime + lifetimeNs;
      this._updateMesh(entity.arrows);
    }
  }

  public updateSettings(settings: LayerSettingsEntity): void {
    this.update(this.userData.entity, settings, this.userData.receiveTime);
  }
}

function createShaftGeometry() {
  const shaftGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
  // Adjust cylinder so ends are centered on (0,0,0) and (1,0,0)
  shaftGeometry.rotateZ(-Math.PI / 2).translate(0.5, 0, 0);
  shaftGeometry.computeBoundingSphere();
  return shaftGeometry;
}

function createShaftEdgesGeometry(geometry: THREE.CylinderGeometry) {
  const shaftEdgesGeometry = new THREE.EdgesGeometry(geometry, 40);
  shaftEdgesGeometry.computeBoundingSphere();
  return shaftEdgesGeometry;
}

function createHeadGeometry() {
  const headGeometry = new THREE.ConeGeometry(0.5, 1, 16);
  // Adjust cone so base is centered on (0,0,0) and tip is at (1,0,0)
  headGeometry.rotateZ(-Math.PI / 2).translate(0.5, 0, 0);
  headGeometry.computeBoundingSphere();
  return headGeometry;
}

function createHeadEdgesGeometry(geometry: THREE.ConeGeometry) {
  const headEdgesGeometry = new THREE.EdgesGeometry(geometry, 40);
  headEdgesGeometry.computeBoundingSphere();
  return headEdgesGeometry;
}
