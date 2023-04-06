// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { crc32 } from "@foxglove/crc";
import { toNanoSec } from "@foxglove/rostime";
import { ModelPrimitive, SceneEntity } from "@foxglove/schemas";

import { RenderablePrimitive } from "./RenderablePrimitive";
import { EDGE_LINE_SEGMENTS_NAME, LoadedModel } from "../../ModelCache";
import type { Renderer } from "../../Renderer";
import { makeRgba, rgbToThreeColor, stringToRgba } from "../../color";
import { disposeMeshesRecursive } from "../../dispose";
import { LayerSettingsEntity } from "../SceneEntities";
import { removeLights, replaceMaterials } from "../models";

const tempRgba = makeRgba();

const MODEL_FETCH_FAILED = "MODEL_FETCH_FAILED";

type RenderableModel = {
  /** Material used to override the model's colors when embedded_materials is false */
  material?: THREE.MeshStandardMaterial;
  /** Model wrapped in a Group to allow setting the group's position/orientation/scale without affecting the model */
  model: THREE.Group;
  /** Reference to the original model before modification so it can be re-cloned if necessary. */
  cachedModel: LoadedModel;
  /** Reference to the original message for checking whether this renderable can be reused */
  primitive: ModelPrimitive;
};

function byteArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

export class RenderableModels extends RenderablePrimitive {
  /** Renderables loaded from embedded data */
  private renderablesByDataCrc = new Map<number, RenderableModel[]>();
  /** Renderables loaded from URLs */
  private renderablesByUrl = new Map<string, RenderableModel[]>();
  private updateCount = 0;

  public constructor(renderer: Renderer) {
    super("", renderer);
  }

  /**
   * Reuse a renderable from `prevRenderables` if a matching one is found using `primitivesMatch()`, otherwise load a new one.
   * @param getURL Called to retrieve the URL that should be used to load the primitive
   * @param revokeURL Called with the URL returned by getURL after loading is complete
   */
  private async _createOrUpdateRenderable(
    primitive: ModelPrimitive,
    prevRenderables: RenderableModel[] | undefined,
    primitivesMatch: (a: ModelPrimitive, b: ModelPrimitive) => boolean,
    getURL: (_: ModelPrimitive) => string,
    revokeURL: (_: string) => void,
  ): Promise<RenderableModel | undefined> {
    let renderable: RenderableModel | undefined;
    if (prevRenderables) {
      const idx = prevRenderables.findIndex((prev) => primitivesMatch(prev.primitive, primitive));
      if (idx >= 0) {
        renderable = prevRenderables.splice(idx, 1)[0]!;
      }
    }
    if (renderable) {
      this._updateModel(renderable, primitive);
      return renderable;
    }

    const url = getURL(primitive);
    try {
      // Load the model if necessary
      const cachedModel = await this._loadCachedModel(url, {
        overrideMediaType: primitive.media_type.length > 0 ? primitive.media_type : undefined,
      });
      if (cachedModel) {
        renderable = { model: cloneAndPrepareModel(cachedModel), cachedModel, primitive };
        this._updateModel(renderable, primitive);
      }
    } finally {
      revokeURL(url);
    }
    return renderable;
  }

  private _updateModels(models: ModelPrimitive[]) {
    this.clear();

    const originalUpdateCount = ++this.updateCount;

    const prevRenderablesByUrl = this.renderablesByUrl;
    this.renderablesByUrl = new Map();

    const prevRenderablesByDataCrc = this.renderablesByDataCrc;
    this.renderablesByDataCrc = new Map();

    Promise.all(
      models.map(async (primitive) => {
        let prevRenderables: RenderableModel[] | undefined;
        let newRenderables: RenderableModel[] | undefined;
        let renderable: RenderableModel | undefined;
        if (primitive.url.length === 0) {
          const dataCrc = crc32(primitive.data);
          prevRenderables = prevRenderablesByDataCrc.get(dataCrc);
          newRenderables = this.renderablesByDataCrc.get(dataCrc);
          if (!newRenderables) {
            newRenderables = [];
            this.renderablesByDataCrc.set(dataCrc, newRenderables);
          }

          try {
            renderable = await this._createOrUpdateRenderable(
              primitive,
              prevRenderables,
              (model1, model2) =>
                model1.media_type === model2.media_type &&
                byteArraysEqual(model1.data, model2.data),
              (model) => URL.createObjectURL(new Blob([model.data], { type: model.media_type })),
              (url) => URL.revokeObjectURL(url),
            );
          } catch (err) {
            this.renderer.settings.errors.add(
              this.userData.settingsPath,
              MODEL_FETCH_FAILED,
              `Unhandled error loading model from ${primitive.data.byteLength}-byte data: ${err.message}`,
            );
          }
        } else {
          prevRenderables = prevRenderablesByUrl.get(primitive.url);
          newRenderables = this.renderablesByUrl.get(primitive.url);
          if (!newRenderables) {
            newRenderables = [];
            this.renderablesByUrl.set(primitive.url, newRenderables);
          }

          try {
            renderable = await this._createOrUpdateRenderable(
              primitive,
              prevRenderables,
              (model1, model2) =>
                model1.url === model2.url && model1.media_type === model2.media_type,
              (model) => model.url,
              (_url) => {},
            );
          } catch (err) {
            this.renderer.settings.errors.add(
              this.userData.settingsPath,
              MODEL_FETCH_FAILED,
              `Unhandled error loading model from "${primitive.url}": ${err.message}`,
            );
          }
        }

        if (originalUpdateCount !== this.updateCount) {
          // another update has come in, bail before doing any mutations
          return;
        }
        if (renderable) {
          newRenderables.push(renderable);
          this.add(renderable.model);

          // Render a new frame now that the model is loaded
          this.renderer.queueAnimationFrame();
        }
      }),
    )
      .then(() => {
        // Remove any mesh fetch error message since loading was successful
        this.renderer.settings.errors.remove(this.userData.settingsPath, MODEL_FETCH_FAILED);
      })
      .catch(console.error)
      .finally(() => {
        // remove remaining models that are no longer used
        for (const renderables of prevRenderablesByUrl.values()) {
          for (const renderable of renderables) {
            renderable.model.removeFromParent();
            this._disposeModel(renderable);
          }
        }
        for (const renderables of prevRenderablesByDataCrc.values()) {
          for (const renderable of renderables) {
            renderable.model.removeFromParent();
            this._disposeModel(renderable);
          }
        }
        this.updateOutlineVisibility();
        this.renderer.queueAnimationFrame();
      });
  }

  public override dispose(): void {
    for (const renderables of this.renderablesByUrl.values()) {
      for (const renderable of renderables) {
        this._disposeModel(renderable);
      }
    }
    this.renderablesByUrl.clear();

    for (const renderables of this.renderablesByDataCrc.values()) {
      for (const renderable of renderables) {
        this._disposeModel(renderable);
      }
    }
    this.renderablesByDataCrc.clear();
  }

  public override update(
    topic: string | undefined,
    entity: SceneEntity | undefined,
    settings: LayerSettingsEntity,
    receiveTime: bigint,
  ): void {
    super.update(topic, entity, settings, receiveTime);
    if (entity) {
      const lifetimeNs = toNanoSec(entity.lifetime);
      this.userData.expiresAt = lifetimeNs === 0n ? undefined : receiveTime + lifetimeNs;
      this._updateModels(entity.models);
    }
  }

  public updateSettings(settings: LayerSettingsEntity): void {
    this.update(this.userData.topic, this.userData.entity, settings, this.userData.receiveTime);
  }

  private updateOutlineVisibility(): void {
    const showOutlines = this.getSettings()?.showOutlines ?? true;
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

  private async _loadCachedModel(
    url: string,
    opts: { overrideMediaType?: string },
  ): Promise<LoadedModel | undefined> {
    const cachedModel = await this.renderer.modelCache.load(
      url,
      { overrideMediaType: opts.overrideMediaType },
      (err) => {
        this.renderer.settings.errors.add(
          this.userData.settingsPath,
          MODEL_FETCH_FAILED,
          `Error loading model from "${url}": ${err.message}`,
        );
      },
    );

    if (!cachedModel) {
      if (!this.renderer.settings.errors.hasError(this.userData.settingsPath, MODEL_FETCH_FAILED)) {
        this.renderer.settings.errors.add(
          this.userData.settingsPath,
          MODEL_FETCH_FAILED,
          `Failed to load model from "${url}"`,
        );
      }
      return undefined;
    }

    return cachedModel;
  }

  private _updateModel(renderable: RenderableModel, primitive: ModelPrimitive) {
    const overrideColor = this.userData.settings.color
      ? stringToRgba(tempRgba, this.userData.settings.color)
      : primitive.override_color
      ? primitive.color
      : undefined;
    if (overrideColor) {
      if (!renderable.material) {
        renderable.material = new THREE.MeshStandardMaterial({
          metalness: 0,
          roughness: 1,
          dithering: true,
        });
        replaceMaterials(renderable.model, renderable.material);
      }
      rgbToThreeColor(renderable.material.color, overrideColor);
      const transparent = overrideColor.a < 1;
      renderable.material.opacity = overrideColor.a;
      renderable.material.transparent = transparent;
      renderable.material.depthWrite = !transparent;
      renderable.material.needsUpdate = true;
    } else if (renderable.material) {
      // We already discarded the original materials, need to re-clone them from the original model
      renderable.model = cloneAndPrepareModel(renderable.cachedModel);
      renderable.material = undefined;
    }

    renderable.model.scale.set(primitive.scale.x, primitive.scale.y, primitive.scale.z);
    renderable.model.position.set(
      primitive.pose.position.x,
      primitive.pose.position.y,
      primitive.pose.position.z,
    );
    renderable.model.quaternion.set(
      primitive.pose.orientation.x,
      primitive.pose.orientation.y,
      primitive.pose.orientation.z,
      primitive.pose.orientation.w,
    );
  }

  private _disposeModel(renderable: RenderableModel) {
    renderable.material?.dispose();
    disposeMeshesRecursive(renderable.model);
    disposeMeshesRecursive(renderable.cachedModel);
  }
}

function cloneAndPrepareModel(cachedModel: LoadedModel) {
  const model = cachedModel.clone(true);
  removeLights(model);
  return new THREE.Group().add(model);
}
