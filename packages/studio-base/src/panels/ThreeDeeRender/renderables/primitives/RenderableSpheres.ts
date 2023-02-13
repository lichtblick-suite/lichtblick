// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";
import { SpherePrimitive, SceneEntity } from "@foxglove/schemas";
import { emptyPose } from "@foxglove/studio-base/util/Pose";

import { RenderablePrimitive } from "./RenderablePrimitive";
import type { Renderer } from "../../Renderer";
import { makeRgba, rgbToThreeColor, stringToRgba } from "../../color";
import { LayerSettingsEntity } from "../SceneEntities";
import { MeshStandardMaterialWithInstanceOpacity } from "../materials/MeshStandardMaterialWithInstanceOpacity";

const tempColor = new THREE.Color();
const tempVec3 = new THREE.Vector3();
const tempVec3_2 = new THREE.Vector3();
const tempMat4 = new THREE.Matrix4();
const tempQuat = new THREE.Quaternion();
const tempRgba = makeRgba();

export class RenderableSpheres extends RenderablePrimitive {
  private geometry: THREE.SphereGeometry;
  private mesh: THREE.InstancedMesh<THREE.SphereGeometry, MeshStandardMaterialWithInstanceOpacity>;
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

  public constructor(renderer: Renderer) {
    super("", renderer, {
      receiveTime: -1n,
      messageTime: -1n,
      frameId: "",
      pose: emptyPose(),
      settings: { visible: true, color: undefined, selectedIdVariable: undefined },
      settingsPath: [],
      entity: undefined,
    });

    // Sphere mesh
    this.geometry = renderer.sharedGeometry
      .getGeometry(this.constructor.name, createGeometry)
      .clone() as THREE.SphereGeometry;
    this.maxInstances = 16;
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.maxInstances);
    this.instanceOpacity = new THREE.InstancedBufferAttribute(
      new Float32Array(this.maxInstances),
      1,
    );
    this.geometry.setAttribute("instanceOpacity", this.instanceOpacity);
    this.mesh.count = 0;
    this.add(this.mesh);
  }

  private _ensureCapacity(numInstances: number) {
    if (numInstances > this.maxInstances) {
      const newCapacity = Math.trunc(numInstances * 1.5) + 16;
      this.maxInstances = newCapacity;

      this.mesh.removeFromParent();
      this.mesh.dispose();
      this.mesh = new THREE.InstancedMesh(this.mesh.geometry, this.material, this.maxInstances);
      this.instanceOpacity = new THREE.InstancedBufferAttribute(
        new Float32Array(this.maxInstances),
        1,
      );
      this.geometry.setAttribute("instanceOpacity", this.instanceOpacity);
      this.add(this.mesh);
    }
  }

  private _updateMesh(spheres: SpherePrimitive[]) {
    let isTransparent = false;

    this._ensureCapacity(spheres.length);

    const overrideColor = this.userData.settings.color
      ? stringToRgba(tempRgba, this.userData.settings.color)
      : undefined;

    let i = 0;
    for (const sphere of spheres) {
      const color = overrideColor ?? sphere.color;
      if (color.a < 1) {
        isTransparent = true;
      }
      this.mesh.setColorAt(i, rgbToThreeColor(tempColor, color));
      this.instanceOpacity.setX(i, color.a);
      this.mesh.setMatrixAt(
        i,
        tempMat4.compose(
          tempVec3.set(sphere.pose.position.x, sphere.pose.position.y, sphere.pose.position.z),
          tempQuat.set(
            sphere.pose.orientation.x,
            sphere.pose.orientation.y,
            sphere.pose.orientation.z,
            sphere.pose.orientation.w,
          ),
          tempVec3_2.set(sphere.size.x, sphere.size.y, sphere.size.z),
        ),
      );
      i++;
    }

    if (this.material.transparent !== isTransparent) {
      this.material.transparent = isTransparent;
      this.material.depthWrite = !isTransparent;
      this.material.needsUpdate = true;
    }

    if (this.mesh.count === 0 && spheres.length > 0) {
      // needed to make colors work: https://discourse.threejs.org/t/instancedmesh-color-doesnt-work-when-initial-count-is-0/41355
      this.material.needsUpdate = true;
    }
    this.mesh.count = spheres.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.instanceOpacity.needsUpdate = true;

    // may be null if we were initialized with count 0 and still have 0 spheres
    if (this.mesh.instanceColor) {
      this.mesh.instanceColor.needsUpdate = true;
    }
  }

  public override dispose(): void {
    this.mesh.dispose();
    this.geometry.dispose();
    this.material.dispose();
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
      this._updateMesh(entity.spheres);
    }
  }

  public updateSettings(settings: LayerSettingsEntity): void {
    this.update(this.userData.topic, this.userData.entity, settings, this.userData.receiveTime);
  }
}

function createGeometry(): THREE.SphereGeometry {
  const sphereGeometry = new THREE.SphereGeometry(0.5, 16, 16);
  sphereGeometry.computeBoundingSphere();
  return sphereGeometry;
}
