// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { LoadedModel } from "../ModelCache";

export type GltfMesh = THREE.Mesh<
  THREE.BufferGeometry,
  THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]
>;

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
    if (!meshChild.geometry.attributes.normal) {
      meshChild.geometry.computeVertexNormals();
    }
  });
}

const ORIGINAL_OPACITY_KEY = "originalOpacity";
const ORIGINAL_TRANSPARENT_KEY = "originalTransparent";
const ORIGINAL_DEPTH_WRITE_KEY = "originalDepthWrite";

function applyOpacityToMaterial(material: THREE.Material, opacity: number): void {
  const storedOpacity = material.userData[ORIGINAL_OPACITY_KEY];
  const storedTransparent = material.userData[ORIGINAL_TRANSPARENT_KEY];
  const storedDepthWrite = material.userData[ORIGINAL_DEPTH_WRITE_KEY];

  const originalOpacity = typeof storedOpacity === "number" ? storedOpacity : material.opacity;
  const originalTransparent =
    typeof storedTransparent === "boolean" ? storedTransparent : material.transparent;
  const originalDepthWrite =
    typeof storedDepthWrite === "boolean" ? storedDepthWrite : material.depthWrite;

  material.userData[ORIGINAL_OPACITY_KEY] = originalOpacity;
  material.userData[ORIGINAL_TRANSPARENT_KEY] = originalTransparent;
  material.userData[ORIGINAL_DEPTH_WRITE_KEY] = originalDepthWrite;

  material.opacity = originalOpacity * opacity;

  // opacity is a uniform; only flip structural flags when they change to avoid shader recompiles
  const newTransparent = originalTransparent || material.opacity < 1;
  const newDepthWrite = material.opacity >= 1 && originalDepthWrite;
  if (material.transparent !== newTransparent || material.depthWrite !== newDepthWrite) {
    material.transparent = newTransparent;
    material.depthWrite = newDepthWrite;
    material.needsUpdate = true;
  }
}

/**
 * Clone embedded materials for this model instance and apply a layer opacity multiplier.
 *
 * Object3D.clone() keeps material references shared with the cached model. Cloning here prevents
 * one transparent URDF from changing other instances that use the same cached mesh. Intrinsic
 * opacity/transparency are stored on the clone so later updates can adjust opacity in place.
 */
export function setEmbeddedMaterialsOpacity(model: LoadedModel, opacity: number): void {
  model.traverse((child: THREE.Object3D) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const cloneWithOpacity = (material: THREE.Material): THREE.Material => {
      const clonedMaterial = material.clone();
      applyOpacityToMaterial(clonedMaterial, opacity);
      return clonedMaterial;
    };

    const materials = child.material as THREE.Material | THREE.Material[];
    child.material = Array.isArray(materials)
      ? materials.map(cloneWithOpacity)
      : cloneWithOpacity(materials);
  });
}

/** Opacity state for the reused traverse callback (safe: traverse is synchronous). */
let updateOpacityState = 1;

const updateEmbeddedOpacityCallback = (child: THREE.Object3D): void => {
  if (!(child instanceof THREE.Mesh)) {
    return;
  }

  const materials = child.material as THREE.Material | THREE.Material[];
  if (Array.isArray(materials)) {
    for (const material of materials) {
      applyOpacityToMaterial(material, updateOpacityState);
    }
  } else {
    applyOpacityToMaterial(materials, updateOpacityState);
  }
};

/** Update previously prepared embedded materials in place (no clone, no multiplier compounding). */
export function updateEmbeddedMaterialsOpacity(model: LoadedModel, opacity: number): void {
  updateOpacityState = opacity;
  model.traverse(updateEmbeddedOpacityCallback);
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
