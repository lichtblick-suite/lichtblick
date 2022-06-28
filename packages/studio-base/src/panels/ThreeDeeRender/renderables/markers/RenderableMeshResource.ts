// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { LoadedModel } from "../../ModelCache";
import type { Renderer } from "../../Renderer";
import { rgbToThreeColor } from "../../color";
import { Marker } from "../../ros";
import { RenderableMarker } from "./RenderableMarker";
import { makeStandardMaterial } from "./materials";

type GltfMesh = THREE.Mesh<
  THREE.BufferGeometry,
  THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]
>;

const MESH_FETCH_FAILED = "MESH_FETCH_FAILED";

export class RenderableMeshResource extends RenderableMarker {
  mesh: THREE.Group | THREE.Scene | undefined;
  material: THREE.MeshStandardMaterial;

  constructor(topic: string, marker: Marker, receiveTime: bigint | undefined, renderer: Renderer) {
    super(topic, marker, receiveTime, renderer);

    this.material = makeStandardMaterial(marker.color);
    this.update(marker, receiveTime, true);
  }

  override dispose(): void {
    this.material.dispose();
  }

  // eslint-disable-next-line @foxglove/no-boolean-parameters
  override update(marker: Marker, receiveTime: bigint | undefined, forceLoad?: boolean): void {
    const prevMarker = this.userData.marker;
    super.update(marker, receiveTime);

    const transparent = marker.color.a < 1;
    if (transparent !== this.material.transparent) {
      this.material.transparent = transparent;
      this.material.depthWrite = !transparent;
      this.material.needsUpdate = true;
    }

    rgbToThreeColor(this.material.color, marker.color);
    this.material.opacity = marker.color.a;

    if (forceLoad === true || marker.mesh_resource !== prevMarker.mesh_resource) {
      const opts = { useEmbeddedMaterials: marker.mesh_use_embedded_materials };
      const errors = this.renderer.settings.errors;
      this._loadModel(marker.mesh_resource, opts)
        .then(() => {
          // Remove any mesh fetch error message since loading was successful
          errors.removeFromTopic(this.userData.topic, MESH_FETCH_FAILED);
          // Render a new frame now that the model is loaded
          this.renderer.animationFrame();
        })
        .catch((err) => {
          errors.addToTopic(
            this.userData.topic,
            MESH_FETCH_FAILED,
            `Unhandled error loading mesh resource from "${marker.mesh_resource}": ${err.message}`,
          );
        });
    }

    this.scale.set(marker.scale.x, marker.scale.y, marker.scale.z);
  }

  private async _loadModel(url: string, opts: { useEmbeddedMaterials: boolean }): Promise<void> {
    if (this.mesh) {
      this.remove(this.mesh);
      this.mesh = undefined;
    }

    const cachedModel = await this.renderer.modelCache.load(url, (err) => {
      this.renderer.settings.errors.addToTopic(
        this.userData.topic,
        MESH_FETCH_FAILED,
        `Failed to load mesh resource from "${url}": ${err.message}`,
      );
    });

    if (!cachedModel) {
      return;
    }

    const mesh = opts.useEmbeddedMaterials
      ? cachedModel
      : replaceMaterials(cachedModel, this.material);
    this.mesh = mesh;
    this.add(mesh);
  }
}

function replaceMaterials(model: LoadedModel, material: THREE.MeshStandardMaterial): LoadedModel {
  const newModel = model.clone(true);
  newModel.traverse((child: THREE.Object3D) => {
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
  return newModel;
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
