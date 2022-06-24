// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { StandardColor } from "../../MaterialCache";
import { LoadedModel } from "../../ModelCache";
import type { Renderer } from "../../Renderer";
import { rgbaEqual } from "../../color";
import { Marker } from "../../ros";
import { RenderableMarker } from "./RenderableMarker";
import { releaseStandardMaterial, standardMaterial } from "./materials";

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

    this.material = standardMaterial(marker.color, renderer.materialCache);
    this.update(marker, receiveTime, true);
  }

  override dispose(): void {
    releaseStandardMaterial(this.userData.marker.color, this.renderer.materialCache);
  }

  // eslint-disable-next-line @foxglove/no-boolean-parameters
  override update(marker: Marker, receiveTime: bigint | undefined, forceLoad?: boolean): void {
    const prevMarker = this.userData.marker;
    super.update(marker, receiveTime);

    if (!rgbaEqual(marker.color, prevMarker.color)) {
      releaseStandardMaterial(prevMarker.color, this.renderer.materialCache);
      this.material = standardMaterial(marker.color, this.renderer.materialCache);
    }

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
        StandardColor.dispose(embeddedMaterial);
      }
    } else {
      StandardColor.dispose(meshChild.material);
    }
    meshChild.material = material;
  });
  return newModel;
}
