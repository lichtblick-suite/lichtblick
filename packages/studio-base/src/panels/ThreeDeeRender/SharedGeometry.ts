// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

/**
 * Class for storing a single instance of each geometry to reuse across scene extensions
 * Callers of `getGeometry` will need to specify a unique key from which to extract the
 * singleton geometry.
 */
export class SharedGeometry {
  private _geometryMap = new Map<string, THREE.BufferGeometry>();

  /**
   * Get a geometry from the map, or create it if it doesn't exist.
   * Note that this map will not allow overwriting of existing geometries.
   * @param key unique key to identify the geometry
   * @param createGeometry - function to create the geometry if it does not exist
   * @returns - created geometry if it doesn't exist or the existing geometry from the map
   */
  public getGeometry<T extends THREE.BufferGeometry>(key: string, createGeometry: () => T): T {
    let geometry = this._geometryMap.get(key);
    if (!geometry) {
      geometry = createGeometry();
      this._geometryMap.set(key, geometry);
    }
    return geometry as T;
  }
  // disposes of all geometries and clears the map
  public dispose(): void {
    for (const geometry of this._geometryMap.values()) {
      geometry.dispose();
    }
    this._geometryMap.clear();
  }
}
