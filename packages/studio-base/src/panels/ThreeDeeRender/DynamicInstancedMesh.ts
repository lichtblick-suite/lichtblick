// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { ColorRGBA, Vector3 } from "./ros";

const INITIAL_CAPACITY = 4;

const tempMat4 = new THREE.Matrix4();
const tempColor = new THREE.Color();

/**
 * Extends InstancedMesh with a set() method that takes a list of points and
 * colors and dynamically resizes the buffer attributes.
 */
export class DynamicInstancedMesh<
  TGeometry extends THREE.BufferGeometry = THREE.BufferGeometry,
  TMaterial extends THREE.Material | THREE.Material[] = THREE.Material | THREE.Material[],
> extends THREE.InstancedMesh<TGeometry, TMaterial> {
  // Total size of the buffer attributes, which can be larger than .count (instances in use)
  private _capacity: number;

  public constructor(geometry: TGeometry, material: TMaterial, initialCapacity = INITIAL_CAPACITY) {
    super(geometry, material, 0);

    this._capacity = initialCapacity;
    this._resize();
  }

  public set(
    points: Vector3[],
    scale: Vector3,
    colors: ColorRGBA[],
    defaultColor: ColorRGBA,
  ): void {
    const count = points.length;
    this._setCount(count);

    for (let i = 0; i < count; i++) {
      const point = points[i]!;
      const color = colors[i] ?? defaultColor;

      tempMat4.makeTranslation(point.x, point.y, point.z);
      tempMat4.scale(scale as THREE.Vector3);
      this.setMatrixAt(i, tempMat4);

      tempColor.setRGB(color.r, color.g, color.b);
      this.setColorAt(i, tempColor);
    }
  }

  private _setCount(count: number) {
    while (count >= this._capacity) {
      this._expand();
    }
    this.count = count;
    this.instanceMatrix.count = count;
    this.instanceColor!.count = count;
  }

  private _expand() {
    this._capacity = this._capacity + Math.trunc(this._capacity / 2) + 16;
    this._resize();
  }

  private _resize() {
    const oldMatrixArray = this.instanceMatrix.array as Float32Array;
    const oldColorArray = this.instanceColor?.array as Float32Array | undefined;

    const newMatrixArray = new Float32Array(this._capacity * 16);
    const newColorArray = new Float32Array(this._capacity * 3);

    if (oldMatrixArray.length > 0) {
      newMatrixArray.set(oldMatrixArray);
    }
    if (oldColorArray && oldColorArray.length > 0) {
      newColorArray.set(oldColorArray);
    }

    this.instanceMatrix = new THREE.InstancedBufferAttribute(newMatrixArray, 16);
    this.instanceColor = new THREE.InstancedBufferAttribute(newColorArray, 3);

    this.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instanceColor.setUsage(THREE.DynamicDrawUsage);
  }
}
