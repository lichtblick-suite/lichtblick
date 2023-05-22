// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { t } from "i18next";
import * as THREE from "three";

import { TwoKeyMap } from "@foxglove/den/collection";
import { PinholeCameraModel } from "@foxglove/den/image";
import { ImageAnnotations as FoxgloveImageAnnotations } from "@foxglove/schemas";
import { Immutable, MessageEvent, SettingsTreeAction, Topic } from "@foxglove/studio";
import { normalizeAnnotations } from "@foxglove/studio-base/panels/Image/lib/normalizeAnnotations";
import {
  ImageMarker as RosImageMarker,
  ImageMarkerArray as RosImageMarkerArray,
} from "@foxglove/studio-base/types/Messages";
import { LabelPool } from "@foxglove/three-text";

import { RenderableTopicAnnotations } from "./RenderableTopicAnnotations";
import { ImageAnnotationSubscription, ImageModeConfig } from "../../../IRenderer";
import { SettingsTreeEntry } from "../../../SettingsManager";
import { IMAGE_ANNOTATIONS_DATATYPES } from "../../../foxglove";
import { IMAGE_MARKER_ARRAY_DATATYPES, IMAGE_MARKER_DATATYPES } from "../../../ros";
import { topicIsConvertibleToSchema } from "../../../topicIsConvertibleToSchema";
import { sortPrefixMatchesToFront } from "../../Images/topicPrefixMatching";

type TopicName = string & { __brand: "TopicName" };
type SchemaName = string & { __brand: "SchemaName" };

interface ImageAnnotationsContext {
  initialScale: number;
  initialCanvasWidth: number;
  initialCanvasHeight: number;
  initialPixelRatio: number;
  topics(): readonly Topic[];
  config(): Immutable<ImageModeConfig>;
  updateConfig(updateHandler: (draft: ImageModeConfig) => void): void;
  updateSettingsTree(): void;
  addSchemaSubscriptions<T>(
    schemaNames: Set<string>,
    handler: (messageEvent: MessageEvent<T>) => void,
  ): void;
  labelPool: LabelPool;
}

const ALL_SUPPORTED_SCHEMAS = new Set([
  ...IMAGE_ANNOTATIONS_DATATYPES,
  ...IMAGE_MARKER_DATATYPES,
  ...IMAGE_MARKER_ARRAY_DATATYPES,
]);

/**
 * Determine whether `subscription`, an entry in {@link ImageModeConfig.annotations}, is the entry
 * that should correspond to `topic` with conversion to `convertTo`.
 */
function subscriptionMatches(
  topic: Topic,
  subscription: ImageAnnotationSubscription,
  convertTo: string | undefined,
): boolean {
  return (
    subscription.topic === topic.name && subscription.schemaName === (convertTo ?? topic.schemaName)
  );
}

/**
 * This class handles settings and rendering for ImageAnnotations/ImageMarkers.
 */
export class ImageAnnotations extends THREE.Object3D {
  #context: ImageAnnotationsContext;

  #renderablesByTopicAndSchemaName = new TwoKeyMap<
    TopicName,
    SchemaName,
    RenderableTopicAnnotations
  >();
  #cameraModel?: PinholeCameraModel;

  #scale: number;
  #canvasWidth: number;
  #canvasHeight: number;
  #pixelRatio: number;

  public constructor(context: ImageAnnotationsContext) {
    super();
    this.#context = context;
    this.#scale = context.initialScale;
    this.#canvasWidth = context.initialCanvasWidth;
    this.#canvasHeight = context.initialCanvasHeight;
    this.#pixelRatio = context.initialPixelRatio;
  }

  public addSubscriptions(): void {
    this.#context.addSchemaSubscriptions(ALL_SUPPORTED_SCHEMAS, this.#handleMessage.bind(this));
  }

  public dispose(): void {
    for (const renderable of this.#renderablesByTopicAndSchemaName.values()) {
      renderable.dispose();
    }
    this.children.length = 0;
    this.#renderablesByTopicAndSchemaName.clear();
  }

  /** Called when seeking or a new data source is loaded.  */
  public removeAllRenderables(): void {
    for (const renderable of this.#renderablesByTopicAndSchemaName.values()) {
      renderable.dispose();
      this.remove(renderable);
    }
    this.#renderablesByTopicAndSchemaName.clear();
  }

  public updateScale(
    scale: number,
    canvasWidth: number,
    canvasHeight: number,
    pixelRatio: number,
  ): void {
    this.#scale = scale;
    this.#canvasWidth = canvasWidth;
    this.#canvasHeight = canvasHeight;
    this.#pixelRatio = pixelRatio;
    for (const renderable of this.#renderablesByTopicAndSchemaName.values()) {
      renderable.setScale(scale, canvasWidth, canvasHeight, pixelRatio);
      renderable.update();
    }
  }

  public updateCameraModel(cameraModel: PinholeCameraModel): void {
    this.#cameraModel = cameraModel;
    for (const renderable of this.#renderablesByTopicAndSchemaName.values()) {
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

    let renderable = this.#renderablesByTopicAndSchemaName.get(
      messageEvent.topic as TopicName,
      messageEvent.schemaName as SchemaName,
    );
    if (!renderable) {
      renderable = new RenderableTopicAnnotations(messageEvent.topic, this.#context.labelPool);
      renderable.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight, this.#pixelRatio);
      renderable.setCameraModel(this.#cameraModel);
      this.#renderablesByTopicAndSchemaName.set(
        messageEvent.topic as TopicName,
        messageEvent.schemaName as SchemaName,
        renderable,
      );
      this.add(renderable);
    }

    renderable.setOriginalMessage(messageEvent.message);
    renderable.setAnnotations(annotations);
    renderable.update();
  }

  #handleSettingsAction(
    topic: Topic,
    convertTo: string | undefined,
    action: SettingsTreeAction,
  ): void {
    if (action.action !== "update" || action.payload.path.length < 2) {
      return;
    }
    const { value } = action.payload;
    if (
      action.payload.path[0] === "imageAnnotations" &&
      action.payload.path[2] === "visible" &&
      typeof value === "boolean"
    ) {
      this.#handleTopicVisibilityChange(topic, convertTo, value);
    }
    this.#context.updateSettingsTree();
  }

  #handleTopicVisibilityChange(
    topic: Topic,
    convertTo: string | undefined,
    visible: boolean, // eslint-disable-line @foxglove/no-boolean-parameters
  ): void {
    this.#context.updateConfig((draft) => {
      draft.annotations ??= [];
      let subscription = draft.annotations.find((sub) =>
        subscriptionMatches(topic, sub, convertTo),
      );
      if (subscription) {
        subscription.settings.visible = visible;
      } else {
        subscription = {
          topic: topic.name,
          schemaName: convertTo ?? topic.schemaName,
          settings: { visible },
        };
        draft.annotations.push(subscription);
      }
    });
    const renderable = this.#renderablesByTopicAndSchemaName.get(
      topic.name as TopicName,
      (convertTo ?? topic.schemaName) as SchemaName,
    );
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

    const annotationTopics = this.#context
      .topics()
      .filter((topic) => topicIsConvertibleToSchema(topic, ALL_SUPPORTED_SCHEMAS));

    // Sort annotation topics with prefixes matching the image topic to the top.
    if (config.imageTopic) {
      sortPrefixMatchesToFront(annotationTopics, config.imageTopic, (topic) => topic.name);
    }

    let i = 0;
    const addEntry = (topic: Topic, convertTo: string | undefined) => {
      const schemaName = convertTo ?? topic.schemaName;
      if (!ALL_SUPPORTED_SCHEMAS.has(schemaName)) {
        return;
      }
      const settings = config.annotations?.find((sub) =>
        subscriptionMatches(topic, sub, convertTo),
      )?.settings;
      entries.push({
        // When building the tree, we just use a numeric index in the path. Inside the handler, this
        // part of the path is ignored, and instead we pass in the `topic` and `convertTo` directly
        // so the handler knows which value to update in the config.
        path: ["imageAnnotations", `${i++}`],
        node: {
          label: topic.name,
          visible: settings?.visible ?? false,
          handler: this.#handleSettingsAction.bind(this, topic, convertTo),
        },
      });
    };
    for (const topic of annotationTopics) {
      addEntry(topic, undefined);
      for (const convertTo of topic.convertibleTo ?? []) {
        addEntry(topic, convertTo);
      }
    }
    return entries;
  }
}
