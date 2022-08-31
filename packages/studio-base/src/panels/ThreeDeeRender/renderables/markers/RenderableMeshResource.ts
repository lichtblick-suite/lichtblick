// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import type { Renderer } from "../../Renderer";
import { rgbToThreeColor } from "../../color";
import { Marker } from "../../ros";
import { removeLights, replaceMaterials } from "../models";
import { RenderableMarker } from "./RenderableMarker";
import { makeStandardMaterial } from "./materials";

export type GltfMesh = THREE.Mesh<
  THREE.BufferGeometry,
  THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]
>;

const MESH_FETCH_FAILED = "MESH_FETCH_FAILED";

export class RenderableMeshResource extends RenderableMarker {
  private mesh: THREE.Group | THREE.Scene | undefined;
  private material: THREE.MeshStandardMaterial;

  public constructor(
    topic: string,
    marker: Marker,
    receiveTime: bigint | undefined,
    renderer: Renderer,
  ) {
    super(topic, marker, receiveTime, renderer);

    this.material = makeStandardMaterial(marker.color);
    this.update(marker, receiveTime, true);
  }

  public override dispose(): void {
    this.material.dispose();
  }

  public override update(
    newMarker: Marker,
    receiveTime: bigint | undefined,
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    forceLoad?: boolean,
  ): void {
    const prevMarker = this.userData.marker;
    super.update(newMarker, receiveTime);
    const marker = this.userData.marker;

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
      this._loadModel(marker.mesh_resource, opts).catch((err) => {
        errors.add(
          this.userData.settingsPath,
          MESH_FETCH_FAILED,
          `Unhandled error loading mesh from "${marker.mesh_resource}": ${err.message}`,
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

    const cachedModel = await this.renderer.modelCache.load(url, {}, (err) => {
      this.renderer.settings.errors.add(
        this.userData.settingsPath,
        MESH_FETCH_FAILED,
        `Error loading mesh from "${url}": ${err.message}`,
      );
    });

    if (!cachedModel) {
      if (!this.renderer.settings.errors.hasError(this.userData.settingsPath, MESH_FETCH_FAILED)) {
        this.renderer.settings.errors.add(
          this.userData.settingsPath,
          MESH_FETCH_FAILED,
          `Failed to load mesh from "${url}"`,
        );
      }
      return;
    }

    const mesh = cachedModel.clone(true);
    removeLights(mesh);
    if (!opts.useEmbeddedMaterials) {
      replaceMaterials(mesh, this.material);
    }

    this.mesh = mesh;
    this.add(mesh);

    // Remove any mesh fetch error message since loading was successful
    this.renderer.settings.errors.remove(this.userData.settingsPath, MESH_FETCH_FAILED);
    // Render a new frame now that the model is loaded
    this.renderer.queueAnimationFrame();
  }
}
