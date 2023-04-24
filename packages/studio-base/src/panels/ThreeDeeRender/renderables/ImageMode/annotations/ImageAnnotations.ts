// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { t } from "i18next";
import { Immutable } from "immer";
import * as THREE from "three";

import { PinholeCameraModel } from "@foxglove/den/image";
import { ImageAnnotations as FoxgloveImageAnnotations } from "@foxglove/schemas";
import { MessageEvent, SettingsTreeAction, Topic } from "@foxglove/studio";
import { normalizeAnnotations } from "@foxglove/studio-base/panels/Image/lib/normalizeAnnotations";
import {
  ImageMarker as RosImageMarker,
  ImageMarkerArray as RosImageMarkerArray,
} from "@foxglove/studio-base/types/Messages";

import { RenderableTopicAnnotations } from "./RenderableTopicAnnotations";
import { ImageModeConfig } from "../../../IRenderer";
import { SettingsTreeEntry } from "../../../SettingsManager";
import { IMAGE_ANNOTATIONS_DATATYPES } from "../../../foxglove";
import { IMAGE_MARKER_ARRAY_DATATYPES, IMAGE_MARKER_DATATYPES } from "../../../ros";
import { topicIsConvertibleToSchema } from "../../../topicIsConvertibleToSchema";

interface ImageAnnotationsContext {
  initialScale: number;
  initialCanvasWidth: number;
  initialCanvasHeight: number;
  topics(): readonly Topic[];
  config(): Immutable<ImageModeConfig>;
  updateConfig(updateHandler: (draft: ImageModeConfig) => void): void;
  updateSettingsTree(): void;
  addSchemaSubscriptions<T>(
    schemaNames: Set<string>,
    handler: (messageEvent: MessageEvent<T>) => void,
  ): void;
}

/**
 * This class handles settings and rendering for ImageAnnotations/ImageMarkers.
 */
export class ImageAnnotations extends THREE.Object3D {
  #context: ImageAnnotationsContext;

  /** FG-3065: support multiple converters per message */
  #renderablesByTopic = new Map<string, RenderableTopicAnnotations>();
  #cameraModel?: PinholeCameraModel;

  #scale: number;
  #canvasWidth: number;
  #canvasHeight: number;

  public constructor(context: ImageAnnotationsContext) {
    super();
    this.#context = context;
    this.#scale = context.initialScale;
    this.#canvasWidth = context.initialCanvasWidth;
    this.#canvasHeight = context.initialCanvasHeight;

    this.#context.addSchemaSubscriptions(
      IMAGE_ANNOTATIONS_DATATYPES,
      this.#handleMessage.bind(this),
    );
    this.#context.addSchemaSubscriptions(IMAGE_MARKER_DATATYPES, this.#handleMessage.bind(this));
    this.#context.addSchemaSubscriptions(
      IMAGE_MARKER_ARRAY_DATATYPES,
      this.#handleMessage.bind(this),
    );
  }

  public dispose(): void {
    for (const renderable of this.#renderablesByTopic.values()) {
      renderable.dispose();
    }
    this.children.length = 0;
    this.#renderablesByTopic.clear();
  }

  /** Called when seeking or a new data source is loaded.  */
  public removeAllRenderables(): void {
    for (const renderable of this.#renderablesByTopic.values()) {
      renderable.dispose();
      this.remove(renderable);
    }
    this.#renderablesByTopic.clear();
  }

  public updateScale(scale: number, canvasWidth: number, canvasHeight: number): void {
    this.#scale = scale;
    this.#canvasWidth = canvasWidth;
    this.#canvasHeight = canvasHeight;
    for (const renderable of this.#renderablesByTopic.values()) {
      renderable.setScale(scale, canvasWidth, canvasHeight);
      renderable.update();
    }
  }

  public updateCameraModel(cameraModel: PinholeCameraModel): void {
    this.#cameraModel = cameraModel;
    for (const renderable of this.#renderablesByTopic.values()) {
      renderable.setCameraModel(cameraModel);
      renderable.update();
    }
  }

  #handleMessage(
    messageEvent: MessageEvent<FoxgloveImageAnnotations | RosImageMarker | RosImageMarkerArray>,
  ) {
    const annotations = normalizeAnnotations(messageEvent.message, messageEvent.schemaName);
    if (!annotations) {
      return;
    }

    let renderable = this.#renderablesByTopic.get(messageEvent.topic);
    if (!renderable) {
      renderable = new RenderableTopicAnnotations();
      renderable.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight);
      renderable.setCameraModel(this.#cameraModel);
      this.#renderablesByTopic.set(messageEvent.topic, renderable);
      this.add(renderable);
    }

    renderable.setAnnotations(annotations);
    renderable.update();
  }

  #handleSettingsAction(topic: Topic, action: SettingsTreeAction): void {
    if (action.action !== "update" || action.payload.path.length < 2) {
      return;
    }
    const { value } = action.payload;
    if (
      action.payload.path[0] === "imageAnnotations" &&
      action.payload.path[2] === "visible" &&
      typeof value === "boolean"
    ) {
      this.#handleTopicVisibilityChange(topic, value);
    }
    this.#context.updateSettingsTree();
  }

  // eslint-disable-next-line @foxglove/no-boolean-parameters
  #handleTopicVisibilityChange(topic: Topic, visible: boolean): void {
    this.#context.updateConfig((draft) => {
      draft.annotations ??= [];
      // FG-3065: support topic.convertTo
      let subscription = draft.annotations.find(
        (sub) => sub.topic === topic.name && sub.schemaName === topic.schemaName,
      );
      if (subscription) {
        subscription.settings.visible = visible;
      } else {
        subscription = {
          topic: topic.name,
          schemaName: topic.schemaName,
          settings: { visible },
        };
        draft.annotations.push(subscription);
      }
    });
    const renderable = this.#renderablesByTopic.get(topic.name);
    if (renderable) {
      renderable.visible = visible;
    }
  }

  public settingsNodes(): SettingsTreeEntry[] {
    const entries: SettingsTreeEntry[] = [];

    entries.push({
      path: ["imageAnnotations"],
      node: {
        label: t("threeDee:imageAnnotations"),
        enableVisibilityFilter: true,
        defaultExpansionState: "expanded",
      },
    });
    const config = this.#context.config();
    let i = 0;
    for (const topic of this.#context.topics()) {
      if (
        !(
          topicIsConvertibleToSchema(topic, IMAGE_ANNOTATIONS_DATATYPES) ||
          topicIsConvertibleToSchema(topic, IMAGE_MARKER_DATATYPES) ||
          topicIsConvertibleToSchema(topic, IMAGE_MARKER_ARRAY_DATATYPES)
        )
      ) {
        continue;
      }
      // FG-3065: support topic.convertTo
      const settings = config.annotations?.find(
        (sub) => sub.topic === topic.name && sub.schemaName === topic.schemaName,
      )?.settings;
      entries.push({
        // When building the tree, we just use a numeric index in the path. Inside the handler, this
        // part of the path is ignored, and instead we pass in the `topic` directly so the handler
        // knows which value to update in the config.
        path: ["imageAnnotations", `${i++}`],
        node: {
          label: topic.name,
          visible: settings?.visible ?? false,
          handler: this.#handleSettingsAction.bind(this, topic),
        },
      });
    }
    return entries;
  }
}
