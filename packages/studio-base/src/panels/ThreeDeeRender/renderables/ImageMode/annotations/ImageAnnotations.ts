// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { t } from "i18next";
import * as THREE from "three";

import { PinholeCameraModel } from "@foxglove/den/image";
import { ImageAnnotations as FoxgloveImageAnnotations } from "@foxglove/schemas";
import { Immutable, MessageEvent, SettingsTreeAction, Topic } from "@foxglove/studio";
import { Path } from "@foxglove/studio-base/panels/ThreeDeeRender/LayerErrors";
import {
  ImageMarker as RosImageMarker,
  ImageMarkerArray as RosImageMarkerArray,
} from "@foxglove/studio-base/types/Messages";
import { LabelPool } from "@foxglove/three-text";

import { RenderableTopicAnnotations } from "./RenderableTopicAnnotations";
import { Annotation } from "./types";
import { AnyRendererSubscription, ImageModeConfig } from "../../../IRenderer";
import { SettingsTreeEntry } from "../../../SettingsManager";
import { IMAGE_ANNOTATIONS_DATATYPES } from "../../../foxglove";
import { IMAGE_MARKER_ARRAY_DATATYPES, IMAGE_MARKER_DATATYPES } from "../../../ros";
import { topicIsConvertibleToSchema } from "../../../topicIsConvertibleToSchema";
import { sortPrefixMatchesToFront } from "../../Images/topicPrefixMatching";
import { IMessageHandler, MessageRenderState } from "../MessageHandler";

const MISSING_SYNCHRONIZED_ANNOTATION = "MISSING_SYNCHRONIZED_ANNOTATION";

type TopicName = string & { __brand: "TopicName" };

interface ImageAnnotationsContext {
  initialScale: number;
  initialCanvasWidth: number;
  initialCanvasHeight: number;
  initialPixelRatio: number;
  topics(): readonly Topic[];
  config(): Immutable<ImageModeConfig>;
  updateConfig(updateHandler: (draft: ImageModeConfig) => void): void;
  updateSettingsTree(): void;
  labelPool: LabelPool;
  messageHandler: IMessageHandler;
  addSettingsError(path: Path, errorId: string, errorMessage: string): void;
  removeSettingsError(path: Path, errorId: string): void;
}

/** For backwards compatibility with previously published type definitions, older studio versions, and webviz */
const LEGACY_ANNOTATION_SCHEMAS = new Set([
  "foxglove_msgs/ImageMarkerArray",
  "foxglove_msgs/msg/ImageMarkerArray",
  "studio_msgs/ImageMarkerArray",
  "studio_msgs/msg/ImageMarkerArray",
  "webviz_msgs/ImageMarkerArray",
]);

const ALL_SUPPORTED_ANNOTATION_SCHEMAS = new Set([
  ...IMAGE_ANNOTATIONS_DATATYPES,
  ...IMAGE_MARKER_DATATYPES,
  ...IMAGE_MARKER_ARRAY_DATATYPES,
  ...LEGACY_ANNOTATION_SCHEMAS,
]);

/**
 * This class handles settings and rendering for ImageAnnotations/ImageMarkers.
 */
export class ImageAnnotations extends THREE.Object3D {
  #context: ImageAnnotationsContext;

  #renderablesByTopic = new Map<TopicName, RenderableTopicAnnotations>();
  #cameraModel?: PinholeCameraModel;

  #scale: number;
  #canvasWidth: number;
  #canvasHeight: number;
  #pixelRatio: number;

  public supportedAnnotationSchemas = ALL_SUPPORTED_ANNOTATION_SCHEMAS;

  public constructor(context: ImageAnnotationsContext) {
    super();
    this.#context = context;
    this.#scale = context.initialScale;
    this.#canvasWidth = context.initialCanvasWidth;
    this.#canvasHeight = context.initialCanvasHeight;
    this.#pixelRatio = context.initialPixelRatio;
    context.messageHandler.addListener(this.#updateFromMessageState);
  }

  public getSubscriptions(): readonly AnyRendererSubscription[] {
    return [
      {
        type: "schema",
        schemaNames: ALL_SUPPORTED_ANNOTATION_SCHEMAS,
        subscription: { handler: this.#context.messageHandler.handleAnnotations },
      },
    ];
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
    for (const renderable of this.#renderablesByTopic.values()) {
      renderable.setScale(scale, canvasWidth, canvasHeight, pixelRatio);
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

  #updateFromMessageState = (newState: MessageRenderState) => {
    if (newState.annotationsByTopic != undefined) {
      for (const { originalMessage, annotations } of newState.annotationsByTopic.values()) {
        this.#handleMessage(originalMessage, annotations);

        // Hide any remaining errors for annotations we are able to render
        this.#context.removeSettingsError(
          ["imageAnnotations", originalMessage.topic],
          MISSING_SYNCHRONIZED_ANNOTATION,
        );
      }
    }
    for (const topic of newState.presentAnnotationTopics ?? []) {
      // Even if a full synchronized set is not found, hide errors for annotations that were present
      this.#context.removeSettingsError(
        ["imageAnnotations", topic],
        MISSING_SYNCHRONIZED_ANNOTATION,
      );
    }
    for (const topic of newState.missingAnnotationTopics ?? []) {
      this.#context.addSettingsError(
        ["imageAnnotations", topic],
        MISSING_SYNCHRONIZED_ANNOTATION,
        "Waiting for annotation message with timestamp matching image. Turn off “Sync annotations” to display annotations regardless of timestamp.",
      );
    }
  };

  #handleMessage(
    messageEvent: MessageEvent<FoxgloveImageAnnotations | RosImageMarker | RosImageMarkerArray>,
    annotations: Annotation[],
  ) {
    let renderable = this.#renderablesByTopic.get(messageEvent.topic as TopicName);
    if (!renderable) {
      renderable = new RenderableTopicAnnotations(messageEvent.topic, this.#context.labelPool);
      renderable.setScale(this.#scale, this.#canvasWidth, this.#canvasHeight, this.#pixelRatio);
      renderable.setCameraModel(this.#cameraModel);
      this.#renderablesByTopic.set(messageEvent.topic as TopicName, renderable);
      this.add(renderable);
    }

    renderable.setOriginalMessage(messageEvent.message);
    renderable.setAnnotations(annotations);
    renderable.update();
  }

  #handleSettingsAction(action: SettingsTreeAction): void {
    if (action.action !== "update" || action.payload.path.length < 2) {
      return;
    }
    const { value, path } = action.payload;
    const topic = path[1]! as TopicName;
    if (path[0] === "imageAnnotations" && path[2] === "visible" && typeof value === "boolean") {
      this.#handleTopicVisibilityChange(topic, value);
    }
    this.#context.updateSettingsTree();
  }

  #handleTopicVisibilityChange(
    topic: TopicName,
    visible: boolean, // eslint-disable-line @foxglove/no-boolean-parameters
  ): void {
    this.#context.updateConfig((draft) => {
      draft.annotations ??= {};
      const settings = (draft.annotations[topic] ??= {});
      settings.visible = visible;
    });
    this.#context.messageHandler.setConfig({
      annotations: this.#context.config().annotations,
    } as Readonly<Partial<ImageModeConfig>>);
    const renderable = this.#renderablesByTopic.get(topic);
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
      .filter((topic) => topicIsConvertibleToSchema(topic, ALL_SUPPORTED_ANNOTATION_SCHEMAS));

    // Sort annotation topics with prefixes matching the image topic to the top.
    if (config.imageTopic) {
      sortPrefixMatchesToFront(annotationTopics, config.imageTopic, (topic) => topic.name);
    }

    for (const topic of annotationTopics) {
      const settings = config.annotations?.[topic.name];
      entries.push({
        path: ["imageAnnotations", topic.name],
        node: {
          label: topic.name,
          visible: settings?.visible ?? false,
          handler: this.#handleSettingsAction.bind(this),
        },
      });
    }
    return entries;
  }
}
