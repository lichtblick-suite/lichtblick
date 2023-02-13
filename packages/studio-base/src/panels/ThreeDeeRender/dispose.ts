// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

export function disposeMaterial(material: THREE.Material): void {
  if (material instanceof THREE.MeshStandardMaterial) {
    material.map?.dispose();
    material.lightMap?.dispose();
    material.aoMap?.dispose();
    material.emissiveMap?.dispose();
    material.bumpMap?.dispose();
    material.normalMap?.dispose();
    material.displacementMap?.dispose();
    material.roughnessMap?.dispose();
    material.metalnessMap?.dispose();
    material.alphaMap?.dispose();
    material.envMap?.dispose();
  }
  material.dispose();
}

export function disposeMeshesRecursive(object: THREE.Object3D): void {
  const disposeAny = (obj: THREE.Object3D) => {
    const maybeDisposable = obj as { dispose?: () => void };
    if (maybeDisposable.dispose) {
      maybeDisposable.dispose();
    } else if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (Array.isArray(obj.material)) {
        for (const material of obj.material) {
          if (material instanceof THREE.Material) {
            disposeMaterial(material);
          }
        }
      } else if (obj.material instanceof THREE.Material) {
        disposeMaterial(obj.material);
      }
    }
  };

  object.traverse(disposeAny);
  disposeAny(object);
  object.removeFromParent();
}
