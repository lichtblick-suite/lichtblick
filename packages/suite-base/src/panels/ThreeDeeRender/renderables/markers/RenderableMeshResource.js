// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import * as THREE from "three";
import { EDGE_LINE_SEGMENTS_NAME } from "@lichtblick/suite-base/panels/ThreeDeeRender/ModelCache";
import { RenderableMarker } from "./RenderableMarker";
import { makeStandardMaterial } from "./materials";
import { rgbToThreeColor } from "../../color";
import { disposeMeshesRecursive } from "../../dispose";
import { removeLights, replaceMaterials } from "../models";
const MESH_FETCH_FAILED = "MESH_FETCH_FAILED";
export class RenderableMeshResource extends RenderableMarker {
    #mesh;
    #material;
    #referenceUrl;
    /** Track updates to avoid race conditions when asynchronously loading models */
    #updateId = 0;
    constructor(topic, marker, receiveTime, renderer, options) {
        super(topic, marker, receiveTime, renderer);
        this.#material = makeStandardMaterial(marker.color);
        this.#referenceUrl = options?.referenceUrl;
        this.update(marker, receiveTime, true);
    }
    dispose() {
        if (this.#mesh) {
            disposeMeshesRecursive(this.#mesh);
        }
        this.#material.dispose();
    }
    update(newMarker, receiveTime, 
    // eslint-disable-next-line @lichtblick/no-boolean-parameters
    forceLoad) {
        const prevMarker = this.userData.marker;
        super.update(newMarker, receiveTime);
        const marker = this.userData.marker;
        const transparent = marker.color.a < 1;
        if (transparent !== this.#material.transparent) {
            this.#material.transparent = transparent;
            this.#material.depthWrite = !transparent;
            this.#material.needsUpdate = true;
        }
        rgbToThreeColor(this.#material.color, marker.color);
        this.#material.opacity = marker.color.a;
        if (forceLoad === true || marker.mesh_resource !== prevMarker.mesh_resource) {
            const curUpdateId = ++this.#updateId;
            const opts = { useEmbeddedMaterials: marker.mesh_use_embedded_materials };
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
                this.add(mesh);
                this.#updateOutlineVisibility();
                // Remove any mesh fetch error message since loading was successful
                this.renderer.settings.errors.remove(this.userData.settingsPath, MESH_FETCH_FAILED);
                // Render a new frame now that the model is loaded
                this.renderer.queueAnimationFrame();
            })
                .catch((err) => {
                errors.add(this.userData.settingsPath, MESH_FETCH_FAILED, `Unhandled error loading mesh from "${marker.mesh_resource}": ${err.message}`);
            });
        }
        this.#updateOutlineVisibility();
        this.scale.set(marker.scale.x, marker.scale.y, marker.scale.z);
    }
    #updateOutlineVisibility() {
        const showOutlines = this.getSettings()?.showOutlines ?? true;
        this.traverse((lineSegments) => {
            // Want to avoid picking up the LineSegments from the model itself
            // only update line segments that we've added with the special name
            if (lineSegments instanceof THREE.LineSegments &&
                lineSegments.name === EDGE_LINE_SEGMENTS_NAME) {
                lineSegments.visible = showOutlines;
            }
        });
    }
    async #loadModel(url, opts) {
        const cachedModel = await this.renderer.modelCache.load(url, { referenceUrl: this.#referenceUrl }, (err) => {
            this.renderer.settings.errors.add(this.userData.settingsPath, MESH_FETCH_FAILED, `Error loading mesh from "${url}": ${err.message}`);
        });
        if (!cachedModel) {
            if (!this.renderer.settings.errors.hasError(this.userData.settingsPath, MESH_FETCH_FAILED)) {
                this.renderer.settings.errors.add(this.userData.settingsPath, MESH_FETCH_FAILED, `Failed to load mesh from "${url}"`);
            }
            return undefined;
        }
        const mesh = cachedModel.clone(true);
        removeLights(mesh);
        if (!opts.useEmbeddedMaterials) {
            replaceMaterials(mesh, this.#material);
        }
        return mesh;
    }
}
