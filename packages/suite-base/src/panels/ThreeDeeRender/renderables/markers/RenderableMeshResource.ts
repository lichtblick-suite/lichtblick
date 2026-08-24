// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { EDGE_LINE_SEGMENTS_NAME } from "@lichtblick/suite-base/panels/ThreeDeeRender/ModelCache";

import { RenderableMarker } from "./RenderableMarker";
import {
  makeStandardMaterial,
  shouldShowMarkerOutlines,
  updateStandardMaterialColor,
} from "./materials";
import type { IRenderer } from "../../IRenderer";
import { disposeMeshesRecursive } from "../../dispose";
import { Marker } from "../../ros";
import {
  removeLights,
  replaceMaterials,
  setEmbeddedMaterialsOpacity,
  updateEmbeddedMaterialsOpacity,
} from "../models";

const MESH_FETCH_FAILED = "MESH_FETCH_FAILED";

export class RenderableMeshResource extends RenderableMarker {
  #mesh: THREE.Group | THREE.Scene | undefined;
  #material: THREE.MeshStandardMaterial;
  #referenceUrl: string | undefined;

  /** Track updates to avoid race conditions when asynchronously loading models */
  #updateId = 0;

  public constructor(
    topic: string,
    marker: Marker,
    receiveTime: bigint | undefined,
    renderer: IRenderer,
    options?: { referenceUrl?: string },
  ) {
    super(topic, marker, receiveTime, renderer);

    this.#material = makeStandardMaterial(marker.color);
    this.#referenceUrl = options?.referenceUrl;
    this.update(marker, receiveTime, true);
  }

  public override dispose(): void {
    if (this.#mesh) {
      disposeMeshesRecursive(this.#mesh);
    }
    this.#material.dispose();
  }

  public override update(
    newMarker: Marker,
    receiveTime: bigint | undefined,
    // eslint-disable-next-line @lichtblick/no-boolean-parameters
    forceLoad?: boolean,
  ): void {
    const prevMarker = this.userData.marker;
    super.update(newMarker, receiveTime);
    const marker = this.userData.marker;

    updateStandardMaterialColor(this.#material, marker.color);

    const embeddedMaterialUsageChanged =
      marker.mesh_use_embedded_materials !== prevMarker.mesh_use_embedded_materials;
    const opacityChanged = marker.color.a !== prevMarker.color.a;
    if (
      forceLoad === true ||
      marker.mesh_resource !== prevMarker.mesh_resource ||
      embeddedMaterialUsageChanged
    ) {
      const curUpdateId = ++this.#updateId;

      const opts = {
        useEmbeddedMaterials: marker.mesh_use_embedded_materials,
        opacity: marker.color.a,
      };
      const errors = this.renderer.settings.errors;
      if (this.#mesh) {
        this.remove(this.#mesh);
        disposeMeshesRecursive(this.#mesh);
        this.#mesh = undefined;
      }
      this.#loadModel(marker.mesh_resource, opts)
        .then((mesh) => {
          if (!mesh) {
            return;
          }
          if (this.#updateId !== curUpdateId) {
            // another update has started
            disposeMeshesRecursive(mesh);
            return;
          }
          this.#mesh = mesh;
          // Opacity may have changed while the load was in flight; apply the latest value.
          if (this.userData.marker.mesh_use_embedded_materials) {
            updateEmbeddedMaterialsOpacity(mesh, this.userData.marker.color.a);
          }
          this.add(mesh);
          this.#updateOutlineVisibility();

          // Remove any mesh fetch error message since loading was successful
          this.renderer.settings.errors.remove(this.userData.settingsPath, MESH_FETCH_FAILED);
          // Render a new frame now that the model is loaded
          this.renderer.queueAnimationFrame();
        })
        .catch((err: unknown) => {
          errors.add(
            this.userData.settingsPath,
            MESH_FETCH_FAILED,
            `Unhandled error loading mesh from "${marker.mesh_resource}": ${(err as Error).message}`,
          );
        });
    } else if (opacityChanged && marker.mesh_use_embedded_materials && this.#mesh != undefined) {
      // Opacity-only updates must not destroy/recreate GPU resources on the hot path.
      updateEmbeddedMaterialsOpacity(this.#mesh, marker.color.a);
    }
    this.#updateOutlineVisibility();

    this.scale.set(marker.scale.x, marker.scale.y, marker.scale.z);
  }

  #updateOutlineVisibility(): void {
    const showOutlines = shouldShowMarkerOutlines({
      showOutlines: this.getSettings()?.showOutlines,
      alpha: this.userData.marker.color.a,
    });
    this.traverse((lineSegments) => {
      // Want to avoid picking up the LineSegments from the model itself
      // only update line segments that we've added with the special name
      if (
        lineSegments instanceof THREE.LineSegments &&
        lineSegments.name === EDGE_LINE_SEGMENTS_NAME
      ) {
        lineSegments.visible = showOutlines;
      }
    });
  }

  async #loadModel(
    url: string,
    opts: { useEmbeddedMaterials: boolean; opacity: number },
  ): Promise<THREE.Group | THREE.Scene | undefined> {
    const cachedModel = await this.renderer.modelCache.load(
      url,
      { referenceUrl: this.#referenceUrl },
      (err) => {
        this.renderer.settings.errors.add(
          this.userData.settingsPath,
          MESH_FETCH_FAILED,
          `Error loading mesh from "${url}": ${err.message}`,
        );
      },
    );

    if (!cachedModel) {
      if (!this.renderer.settings.errors.hasError(this.userData.settingsPath, MESH_FETCH_FAILED)) {
        this.renderer.settings.errors.add(
          this.userData.settingsPath,
          MESH_FETCH_FAILED,
          `Failed to load mesh from "${url}"`,
        );
      }
      return undefined;
    }

    const mesh = cachedModel.clone(true);
    removeLights(mesh);
    if (!opts.useEmbeddedMaterials) {
      replaceMaterials(mesh, this.#material);
    } else {
      setEmbeddedMaterialsOpacity(mesh, opts.opacity);
    }

    return mesh;
  }
}
