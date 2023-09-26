// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";
import { CubePrimitive, SceneEntity } from "@foxglove/schemas";

import { RenderablePrimitive } from "./RenderablePrimitive";
import type { IRenderer } from "../../IRenderer";
import { makeRgba, rgbToThreeColor, stringToRgba } from "../../color";
import { LayerSettingsEntity } from "../../settings";
import { MeshStandardMaterialWithInstanceOpacity } from "../materials/MeshStandardMaterialWithInstanceOpacity";

const tempColor = new THREE.Color();
const tempVec3 = new THREE.Vector3();
const tempVec3_2 = new THREE.Vector3();
const tempMat4 = new THREE.Matrix4();
const tempQuat = new THREE.Quaternion();
const tempRgba = makeRgba();

export class RenderableCubes extends RenderablePrimitive {
  // Each RenderableCubes needs its own geometry because we attach additional custom attributes to it.
  #mesh: THREE.InstancedMesh<THREE.BoxGeometry, MeshStandardMaterialWithInstanceOpacity>;
  #instanceOpacity: THREE.InstancedBufferAttribute;
  #material = new MeshStandardMaterialWithInstanceOpacity({
    metalness: 0,
    roughness: 1,
    dithering: true,
  });

  /**
   * The initial count passed to `mesh`'s constructor, i.e. the maximum number of instances it can
   * render before we need to create a new mesh object
   */
  #maxInstances: number;

  #outlineGeometry: THREE.InstancedBufferGeometry;
  #outline: THREE.LineSegments;
  #geometry: THREE.BoxGeometry;
  // actual shared geometry across instances, only copy -- do not modify
  // stored for ease of use
  #sharedEdgesGeometry: THREE.EdgesGeometry;

  public constructor(renderer: IRenderer) {
    super("", renderer);

    // Cube mesh
    this.#geometry = renderer.sharedGeometry
      .getGeometry(`${this.constructor.name}-cube`, createCubeGeometry)
      .clone();

    this.#maxInstances = 16;
    this.#mesh = new THREE.InstancedMesh(this.#geometry, this.#material, this.#maxInstances);
    this.#instanceOpacity = new THREE.InstancedBufferAttribute(
      new Float32Array(this.#maxInstances),
      1,
    );
    this.#geometry.setAttribute("instanceOpacity", this.#instanceOpacity);
    this.#mesh.count = 0;
    this.add(this.#mesh);

    // Cube outline
    this.#sharedEdgesGeometry = renderer.sharedGeometry.getGeometry(
      `${this.constructor.name}-edges`,
      () => createEdgesGeometry(this.#geometry),
    );
    this.#outlineGeometry = new THREE.InstancedBufferGeometry();
    (this.#outlineGeometry as THREE.BufferGeometry).copy(this.#sharedEdgesGeometry);
    this.#outlineGeometry.setAttribute("instanceMatrix", this.#mesh.instanceMatrix);
    this.#outline = new THREE.LineSegments(
      this.#outlineGeometry,
      renderer.instancedOutlineMaterial,
    );
    this.#outline.frustumCulled = false;
    this.#outline.userData.picking = false;
    this.add(this.#outline);
  }

  #ensureCapacity(numCubes: number) {
    if (numCubes > this.#maxInstances) {
      const newCapacity = Math.trunc(numCubes * 1.5) + 16;
      this.#maxInstances = newCapacity;

      this.#mesh.removeFromParent();
      this.#mesh.dispose();
      this.#mesh = new THREE.InstancedMesh(this.#geometry, this.#material, this.#maxInstances);
      this.#instanceOpacity = new THREE.InstancedBufferAttribute(
        new Float32Array(this.#maxInstances),
        1,
      );
      this.#geometry.setAttribute("instanceOpacity", this.#instanceOpacity);
      this.add(this.#mesh);

      // THREE.js doesn't correctly recompute the new max instance count when dynamically
      // reassigning the attribute of InstancedBufferGeometry, so we just create a new geometry
      this.#outlineGeometry.dispose();
      this.#outlineGeometry = new THREE.InstancedBufferGeometry();
      (this.#outlineGeometry as THREE.BufferGeometry).copy(this.#sharedEdgesGeometry);
      this.#outlineGeometry.instanceCount = newCapacity;
      this.#outlineGeometry.setAttribute("instanceMatrix", this.#mesh.instanceMatrix);
      this.#outline.geometry = this.#outlineGeometry;
    }
  }

  #updateMesh(cubes: CubePrimitive[]) {
    let isTransparent = false;

    this.#ensureCapacity(cubes.length);

    const overrideColor = this.userData.settings.color
      ? stringToRgba(tempRgba, this.userData.settings.color)
      : undefined;

    let i = 0;
    for (const cube of cubes) {
      const color = overrideColor ?? cube.color;
      if (color.a < 1) {
        isTransparent = true;
      }
      this.#mesh.setColorAt(i, rgbToThreeColor(tempColor, color));
      this.#instanceOpacity.setX(i, color.a);
      this.#mesh.setMatrixAt(
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

    if (this.#material.transparent !== isTransparent) {
      this.#material.transparent = isTransparent;
      this.#material.depthWrite = !isTransparent;
      this.#material.needsUpdate = true;
    }

    if (this.#mesh.count === 0 && cubes.length > 0) {
      // needed to make colors work: https://discourse.threejs.org/t/instancedmesh-color-doesnt-work-when-initial-count-is-0/41355
      this.#material.needsUpdate = true;
    }
    this.#mesh.count = cubes.length;
    this.#outlineGeometry.instanceCount = cubes.length;
    this.#mesh.instanceMatrix.needsUpdate = true;
    this.#instanceOpacity.needsUpdate = true;

    // may be null if we were initialized with count 0 and still have 0 primitives
    if (this.#mesh.instanceColor) {
      this.#mesh.instanceColor.needsUpdate = true;
    }
  }

  public override dispose(): void {
    this.#mesh.dispose();
    this.#geometry.dispose();
    this.#material.dispose();
    this.#outlineGeometry.dispose();
  }

  public override update(
    topic: string | undefined,
    entity: SceneEntity | undefined,
    settings: LayerSettingsEntity,
    receiveTime: bigint,
  ): void {
    super.update(topic, entity, settings, receiveTime);
    if (entity) {
      const lifetimeNs = toNanoSec(entity.lifetime);
      this.userData.expiresAt = lifetimeNs === 0n ? undefined : receiveTime + lifetimeNs;
      this.#updateMesh(entity.cubes);
      this.#outline.visible = settings.showOutlines ?? true;
    }
  }

  public updateSettings(settings: LayerSettingsEntity): void {
    this.update(this.userData.topic, this.userData.entity, settings, this.userData.receiveTime);
  }
}

function createCubeGeometry(): THREE.BoxGeometry {
  const cubeGeometry = new THREE.BoxGeometry(1, 1, 1);
  cubeGeometry.computeBoundingSphere();
  return cubeGeometry;
}

function createEdgesGeometry(cubeGeometry: THREE.BoxGeometry): THREE.EdgesGeometry {
  const cubeEdgesGeometry = new THREE.EdgesGeometry(cubeGeometry, 40);
  cubeEdgesGeometry.computeBoundingSphere();
  return cubeEdgesGeometry;
}
