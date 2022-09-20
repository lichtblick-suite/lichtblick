// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";
import { CubePrimitive, SceneEntity } from "@foxglove/schemas";
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

export class RenderableCubes extends RenderablePrimitive {
  private static cubeGeometry: THREE.BoxGeometry | undefined;
  private static cubeEdgesGeometry: THREE.EdgesGeometry | undefined;

  // Each RenderableCubes needs its own geometry because we attach additional custom attributes to it.
  private geometry = new THREE.BoxGeometry(1, 1, 1);
  private mesh: THREE.InstancedMesh<THREE.BoxGeometry, MeshStandardMaterialWithInstanceOpacity>;
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

  private outlineGeometry: THREE.InstancedBufferGeometry;
  private outline: THREE.LineSegments;

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

    // Cube mesh
    this.maxInstances = 16;
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.maxInstances);
    this.instanceOpacity = new THREE.InstancedBufferAttribute(
      new Float32Array(this.maxInstances),
      1,
    );
    this.geometry.setAttribute("instanceOpacity", this.instanceOpacity);
    this.mesh.count = 0;
    this.add(this.mesh);

    // Cube outline
    this.outlineGeometry = new THREE.InstancedBufferGeometry().copy(
      RenderableCubes.EdgesGeometry(),
    );
    this.outlineGeometry.setAttribute("instanceMatrix", this.mesh.instanceMatrix);
    this.outline = new THREE.LineSegments(this.outlineGeometry, renderer.instancedOutlineMaterial);
    this.outline.frustumCulled = false;
    this.outline.userData.picking = false;
    this.add(this.outline);
  }

  private _ensureCapacity(numCubes: number) {
    if (numCubes > this.maxInstances) {
      const newCapacity = Math.trunc(numCubes * 1.5) + 16;
      this.maxInstances = newCapacity;

      this.mesh.removeFromParent();
      this.mesh.dispose();
      this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.maxInstances);
      this.instanceOpacity = new THREE.InstancedBufferAttribute(
        new Float32Array(this.maxInstances),
        1,
      );
      this.geometry.setAttribute("instanceOpacity", this.instanceOpacity);
      this.add(this.mesh);

      // THREE.js doesn't correctly recompute the new max instance count when dynamically
      // reassigning the attribute of InstancedBufferGeometry, so we just create a new geometry
      this.outlineGeometry.dispose();
      this.outlineGeometry = new THREE.InstancedBufferGeometry().copy(
        RenderableCubes.EdgesGeometry(),
      );
      this.outlineGeometry.instanceCount = newCapacity;
      this.outlineGeometry.setAttribute("instanceMatrix", this.mesh.instanceMatrix);
      this.outline.geometry = this.outlineGeometry;
    }
  }

  private _updateMesh(cubes: CubePrimitive[]) {
    let isTransparent = false;

    this._ensureCapacity(cubes.length);

    const overrideColor = this.userData.settings.color
      ? stringToRgba(tempRgba, this.userData.settings.color)
      : undefined;

    let i = 0;
    for (const cube of cubes) {
      const color = overrideColor ?? cube.color;
      if (color.a < 1) {
        isTransparent = true;
      }
      this.mesh.setColorAt(i, rgbToThreeColor(tempColor, color));
      this.instanceOpacity.setX(i, color.a);
      this.mesh.setMatrixAt(
        i,
        tempMat4.compose(
          tempVec3.set(cube.pose.position.x, cube.pose.position.y, cube.pose.position.z),
          tempQuat.set(
            cube.pose.orientation.x,
            cube.pose.orientation.y,
            cube.pose.orientation.z,
            cube.pose.orientation.w,
          ),
          tempVec3_2.set(cube.size.x, cube.size.y, cube.size.z),
        ),
      );
      i++;
    }

    if (this.material.transparent !== isTransparent) {
      this.material.transparent = isTransparent;
      this.material.depthWrite = !isTransparent;
      this.material.needsUpdate = true;
    }

    if (this.mesh.count === 0 && cubes.length > 0) {
      // needed to make colors work: https://discourse.threejs.org/t/instancedmesh-color-doesnt-work-when-initial-count-is-0/41355
      this.material.needsUpdate = true;
    }
    this.mesh.count = cubes.length;
    this.outlineGeometry.instanceCount = cubes.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.instanceOpacity.needsUpdate = true;

    // may be null if we were initialized with count 0 and still have 0 primitives
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  public override dispose(): void {
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
    this.outlineGeometry.dispose();
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
      this._updateMesh(entity.cubes);
    }
  }

  public updateSettings(settings: LayerSettingsEntity): void {
    this.update(this.userData.entity, settings, this.userData.receiveTime);
  }

  private static Geometry(): THREE.BoxGeometry {
    if (!RenderableCubes.cubeGeometry) {
      RenderableCubes.cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
      RenderableCubes.cubeGeometry.computeBoundingSphere();
    }
    return RenderableCubes.cubeGeometry;
  }

  private static EdgesGeometry(): THREE.EdgesGeometry {
    if (!RenderableCubes.cubeEdgesGeometry) {
      RenderableCubes.cubeEdgesGeometry = new THREE.EdgesGeometry(RenderableCubes.Geometry(), 40);
      RenderableCubes.cubeEdgesGeometry.computeBoundingSphere();
    }
    return RenderableCubes.cubeEdgesGeometry;
  }
}
