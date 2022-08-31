// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { LoadedModel } from "../ModelCache";
import { GltfMesh } from "./markers/RenderableMeshResource";

export function removeLights(model: LoadedModel): void {
  // Remove lights from the model
  const lights: THREE.Light[] = [];
  model.traverse((child: THREE.Object3D) => {
    const maybeLight = child as Partial<THREE.Light>;
    if (maybeLight.isLight === true) {
      lights.push(maybeLight as THREE.Light);
    }
  });
  for (const light of lights) {
    light.dispose();
    light.removeFromParent();
  }
}

export function replaceMaterials(model: LoadedModel, material: THREE.MeshStandardMaterial): void {
  model.traverse((child: THREE.Object3D) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    // Dispose of any allocated textures and the material and swap it with
    // our own material
    const meshChild = child as GltfMesh;
    if (Array.isArray(meshChild.material)) {
      for (const embeddedMaterial of meshChild.material) {
        disposeStandardMaterial(embeddedMaterial);
      }
    } else {
      disposeStandardMaterial(meshChild.material);
    }
    meshChild.material = material;
  });
}

/** Generic MeshStandardMaterial dispose function for materials loaded from an external source */
function disposeStandardMaterial(material: THREE.MeshStandardMaterial): void {
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
  material.dispose();
}
