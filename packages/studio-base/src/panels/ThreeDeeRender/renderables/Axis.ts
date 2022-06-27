// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { MaterialCache, StandardColor } from "../MaterialCache";
import { Renderer } from "../Renderer";
import { arrowHeadSubdivisions, arrowShaftSubdivisions, DetailLevel } from "../lod";

const SHAFT_LENGTH = 0.154;
const SHAFT_DIAMETER = 0.02;
const HEAD_LENGTH = 0.046;
const HEAD_DIAMETER = 0.05;

export const AXIS_LENGTH = SHAFT_LENGTH + HEAD_LENGTH;

const RED_COLOR = new THREE.Color(0x9c3948).convertSRGBToLinear();
const GREEN_COLOR = new THREE.Color(0x88dd04).convertSRGBToLinear();
const BLUE_COLOR = new THREE.Color(0x2b90fb).convertSRGBToLinear();

const COLOR_WHITE = { r: 1, g: 1, b: 1, a: 1 };

const PI_2 = Math.PI / 2;

const tempMat4 = new THREE.Matrix4();
const tempVec = new THREE.Vector3();

export class Axis extends THREE.Object3D {
  private static shaftLod: DetailLevel | undefined;
  private static headLod: DetailLevel | undefined;
  private static shaftGeometry: THREE.CylinderGeometry | undefined;
  private static headGeometry: THREE.ConeGeometry | undefined;

  readonly renderer: Renderer;
  shaftMesh: THREE.InstancedMesh;
  headMesh: THREE.InstancedMesh;

  constructor(name: string, renderer: Renderer) {
    super();
    this.name = name;
    this.renderer = renderer;

    // Create three arrow shafts
    const arrowMaterial = standardMaterial(this.renderer.materialCache);
    const shaftGeometry = Axis.ShaftGeometry(this.renderer.maxLod);
    this.shaftMesh = new THREE.InstancedMesh(shaftGeometry, arrowMaterial, 3);
    this.shaftMesh.castShadow = true;
    this.shaftMesh.receiveShadow = true;

    // Create three arrow heads
    const headGeometry = Axis.HeadGeometry(this.renderer.maxLod);
    this.headMesh = new THREE.InstancedMesh(headGeometry, arrowMaterial, 3);
    this.headMesh.castShadow = true;
    this.headMesh.receiveShadow = true;

    Axis.UpdateInstances(this.shaftMesh, this.headMesh, 0);

    this.add(this.shaftMesh);
    this.add(this.headMesh);
  }

  dispose(): void {
    releaseStandardMaterial(this.renderer.materialCache);
    this.shaftMesh.dispose();
    this.headMesh.dispose();
  }

  static UpdateInstances(
    shaft: THREE.InstancedMesh,
    head: THREE.InstancedMesh,
    axisIndex: number,
  ): void {
    const indexX = axisIndex * 3 + 0;
    const indexY = axisIndex * 3 + 1;
    const indexZ = axisIndex * 3 + 2;

    // Set x, y, and z axis arrow shaft directions
    tempVec.set(SHAFT_LENGTH, SHAFT_DIAMETER, SHAFT_DIAMETER);
    shaft.setMatrixAt(indexX, tempMat4.identity().scale(tempVec));
    shaft.setMatrixAt(indexY, tempMat4.makeRotationZ(PI_2).scale(tempVec));
    shaft.setMatrixAt(indexZ, tempMat4.makeRotationY(-PI_2).scale(tempVec));

    // Set x, y, and z axis arrow head directions
    tempVec.set(HEAD_LENGTH, HEAD_DIAMETER, HEAD_DIAMETER);
    tempMat4.identity().scale(tempVec).setPosition(SHAFT_LENGTH, 0, 0);
    head.setMatrixAt(indexX, tempMat4);
    tempMat4.makeRotationZ(PI_2).scale(tempVec).setPosition(0, SHAFT_LENGTH, 0);
    head.setMatrixAt(indexY, tempMat4);
    tempMat4.makeRotationY(-PI_2).scale(tempVec).setPosition(0, 0, SHAFT_LENGTH);
    head.setMatrixAt(indexZ, tempMat4);

    // Set x, y, and z axis arrow shaft colors
    shaft.setColorAt(indexX, RED_COLOR);
    shaft.setColorAt(indexY, GREEN_COLOR);
    shaft.setColorAt(indexZ, BLUE_COLOR);

    // Set x, y, and z axis arrow head colors
    head.setColorAt(indexX, RED_COLOR);
    head.setColorAt(indexY, GREEN_COLOR);
    head.setColorAt(indexZ, BLUE_COLOR);
  }

  static ShaftGeometry(lod: DetailLevel): THREE.CylinderGeometry {
    if (!Axis.shaftGeometry || lod !== Axis.shaftLod) {
      const subdivs = arrowShaftSubdivisions(lod);
      Axis.shaftGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, subdivs, 1, false);
      Axis.shaftGeometry.rotateZ(-PI_2);
      Axis.shaftGeometry.translate(0.5, 0, 0);
      Axis.shaftGeometry.computeBoundingSphere();
      Axis.shaftLod = lod;
    }
    return Axis.shaftGeometry;
  }

  static HeadGeometry(lod: DetailLevel): THREE.ConeGeometry {
    if (!Axis.headGeometry || lod !== Axis.headLod) {
      const subdivs = arrowHeadSubdivisions(lod);
      Axis.headGeometry = new THREE.ConeGeometry(0.5, 1, subdivs, 1, false);
      Axis.headGeometry.rotateZ(-PI_2);
      Axis.headGeometry.translate(0.5, 0, 0);
      Axis.headGeometry.computeBoundingSphere();
      Axis.headLod = lod;
    }
    return Axis.headGeometry;
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
