// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";

import { toNanoSec } from "@foxglove/rostime";
import { ModelPrimitive, SceneEntity } from "@foxglove/schemas";
import { emptyPose } from "@foxglove/studio-base/util/Pose";

import { LoadedModel } from "../../ModelCache";
import type { Renderer } from "../../Renderer";
import { makeRgba, rgbToThreeColor, stringToRgba } from "../../color";
import { disposeMeshesRecursive } from "../../dispose";
import { LayerSettingsEntity } from "../SceneEntities";
import { removeLights, replaceMaterials } from "../models";
import { RenderablePrimitive } from "./RenderablePrimitive";

const tempRgba = makeRgba();

const MODEL_FETCH_FAILED = "MODEL_FETCH_FAILED";

type RenderableModel = {
  /** Material used to override the model's colors when embedded_materials is false */
  material?: THREE.MeshStandardMaterial;
  /** Model wrapped in a Group to allow setting the group's position/orientation/scale without affecting the model */
  model: THREE.Group;
  /** Reference to the original model before modification so it can be re-cloned if necessary. */
  cachedModel: LoadedModel;
};

export class RenderableModels extends RenderablePrimitive {
  private renderablesByUrl = new Map<string, RenderableModel[]>();
  private updateCount = 0;

  public constructor(renderer: Renderer) {
    super("", renderer, {
      receiveTime: -1n,
      messageTime: -1n,
      frameId: "",
      pose: emptyPose(),
      settings: { visible: true, color: undefined },
      settingsPath: [],
      entity: undefined,
    });
  }

  private _updateModels(models: ModelPrimitive[]) {
    this.clear();

    const originalUpdateCount = ++this.updateCount;

    const prevRenderablesByUrl = this.renderablesByUrl;
    this.renderablesByUrl = new Map();

    Promise.all(
      models.map(async (primitive) => {
        let url = primitive.url;
        let objectUrl: string | undefined;
        if (url.length === 0) {
          url = objectUrl = URL.createObjectURL(
            new Blob([primitive.data], { type: primitive.media_type }),
          );
        }
        let newRenderables = this.renderablesByUrl.get(url);
        if (!newRenderables) {
          newRenderables = [];
          this.renderablesByUrl.set(url, newRenderables);
        }
        try {
          let renderable = prevRenderablesByUrl.get(url)?.pop();
          // Use an existing model that we previously loaded
          if (renderable) {
            this._updateModel(renderable, primitive);
          } else {
            // Load the model if necessary
            const cachedModel = await this._loadCachedModel(url, {
              overrideMediaType: primitive.media_type.length > 0 ? primitive.media_type : undefined,
            });
            if (cachedModel) {
              renderable = { model: cloneAndPrepareModel(cachedModel), cachedModel };
              this._updateModel(renderable, primitive);
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
        } catch (err) {
          this.renderer.settings.errors.add(
            this.userData.settingsPath,
            MODEL_FETCH_FAILED,
            `Unhandled error loading model from ${
              objectUrl != undefined ? `${primitive.data.byteLength}-byte data` : `"${url}"`
            }: ${err.message}`,
          );
        } finally {
          if (objectUrl != undefined) {
            URL.revokeObjectURL(objectUrl);
          }
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
      });
  }

  public override dispose(): void {
    for (const renderables of this.renderablesByUrl.values()) {
      for (const renderable of renderables) {
        this._disposeModel(renderable);
      }
    }
    this.renderablesByUrl.clear();
  }

  public override update(
    entity: SceneEntity | undefined,
    settings: LayerSettingsEntity,
    receiveTime: bigint,
  ): void {
    this.userData.entity = entity;
    this.userData.settings = settings;
    this.userData.receiveTime = receiveTime;
    if (entity) {
      const lifetimeNs = toNanoSec(entity.lifetime);
      this.userData.expiresAt = lifetimeNs === 0n ? undefined : receiveTime + lifetimeNs;
      this._updateModels(entity.models);
    }
  }

  public updateSettings(settings: LayerSettingsEntity): void {
    this.update(this.userData.entity, settings, this.userData.receiveTime);
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

  /**
   * @returns true if model was successfully updated, false if it needs to be reloaded
   */
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

    return true;
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
