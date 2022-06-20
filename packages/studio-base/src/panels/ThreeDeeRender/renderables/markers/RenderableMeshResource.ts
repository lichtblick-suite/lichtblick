// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { StandardColor } from "../../MaterialCache";
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
  mesh: THREE.Group | undefined;
  material: THREE.MeshStandardMaterial;

  constructor(topic: string, marker: Marker, receiveTime: bigint | undefined, renderer: Renderer) {
    super(topic, marker, receiveTime, renderer);

    this.material = standardMaterial(marker.color, renderer.materialCache);

    this._loadModel(marker.mesh_resource, {
      useEmbeddedMaterials: marker.mesh_use_embedded_materials,
    }).catch(() => {});

    this.update(marker, receiveTime);
  }

  override dispose(): void {
    releaseStandardMaterial(this.userData.marker.color, this.renderer.materialCache);
  }

  override update(marker: Marker, receiveTime: bigint | undefined): void {
    const prevMarker = this.userData.marker;
    super.update(marker, receiveTime);

    if (!rgbaEqual(marker.color, prevMarker.color)) {
      releaseStandardMaterial(prevMarker.color, this.renderer.materialCache);
      this.material = standardMaterial(marker.color, this.renderer.materialCache);
    }

    if (marker.mesh_resource !== prevMarker.mesh_resource) {
      this._loadModel(marker.mesh_resource, {
        useEmbeddedMaterials: marker.mesh_use_embedded_materials,
      }).catch(() => {});
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

    const mesh = cachedModel.scene.clone(true);
    const edgesToAdd: [edges: THREE.LineSegments, parent: THREE.Object3D][] = [];

    mesh.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      // Enable shadows for all meshes
      child.castShadow = true;
      child.receiveShadow = true;

      // Draw edges for all meshes
      const edgesGeometry = new THREE.EdgesGeometry(child.geometry, 40);
      const line = new THREE.LineSegments(
        edgesGeometry,
        this.renderer.materialCache.outlineMaterial,
      );
      edgesToAdd.push([line, child]);

      if (!opts.useEmbeddedMaterials) {
        // Dispose of any allocated textures and the material and swap it with
        // our own material
        const meshChild = child as GltfMesh;
        if (Array.isArray(meshChild.material)) {
          for (const material of meshChild.material) {
            StandardColor.dispose(material);
          }
        } else {
          StandardColor.dispose(meshChild.material);
        }
        meshChild.material = this.material;
      }
    });

    for (const [line, parent] of edgesToAdd) {
      parent.add(line);
    }

    this.mesh = mesh;
    this.add(this.mesh);
  }
}
