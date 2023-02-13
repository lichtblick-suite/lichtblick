// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

interface TypedArray {
  readonly length: number;
  readonly [n: number]: number;
  BYTES_PER_ELEMENT: number;
  set(n: ArrayLike<number>, offset: number): void;
}

interface TypedArrayConstructor<T extends TypedArray> {
  new (length: number): T;
}

interface ArrayConstructor {
  new (length: number): ArrayLike<number>;
}

export class DynamicBufferGeometry extends THREE.BufferGeometry {
  public override attributes: { [name: string]: THREE.BufferAttribute } = {};

  private _attributeConstructors = new Map<string, ArrayConstructor>();
  private _usage: THREE.Usage;
  private _itemCapacity = 0;

  public constructor(usage: THREE.Usage = THREE.DynamicDrawUsage) {
    super();
    this._usage = usage;
  }

  public setUsage(usage: THREE.Usage): void {
    this._usage = usage;
    for (const attribute of Object.values(this.attributes)) {
      attribute.setUsage(usage);
    }
  }

  public createAttribute<T extends TypedArray, C extends TypedArrayConstructor<T>>(
    name: THREE.BuiltinShaderAttributeName | string,
    arrayConstructor: C,
    itemSize: number,
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    normalized?: boolean,
  ): THREE.BufferGeometry {
    const data = new arrayConstructor(this._itemCapacity * itemSize);
    const attribute = new THREE.BufferAttribute(data, itemSize, normalized);
    attribute.setUsage(this._usage);
    this._attributeConstructors.set(name, arrayConstructor);
    return this.setAttribute(name, attribute);
  }

  public resize(itemCount: number): void {
    this.setDrawRange(0, itemCount);

    if (itemCount <= this._itemCapacity) {
      for (const attribute of Object.values(this.attributes)) {
        attribute.count = itemCount;
      }
      return;
    }

    for (const [attributeName, attribute] of Object.entries(this.attributes)) {
      const dataConstructor = this._attributeConstructors.get(attributeName);
      if (!dataConstructor) {
        throw new Error(
          `DynamicBufferGeometry resize(${itemCount}) failed, missing data constructor for attribute "${attributeName}". Attributes must be created using createAttribute().`,
        );
      }
      const data = new dataConstructor(itemCount * attribute.itemSize);
      const newAttrib = new THREE.BufferAttribute(data, attribute.itemSize, attribute.normalized);
      newAttrib.setUsage(this._usage);
      this.setAttribute(attributeName, newAttrib);
    }

    this._itemCapacity = itemCount;
  }
}
