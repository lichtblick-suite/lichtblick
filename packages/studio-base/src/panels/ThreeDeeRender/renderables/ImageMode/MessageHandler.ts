// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable } from "immer";

import { AVLTree } from "@foxglove/avl";
import { TwoKeyMap } from "@foxglove/den/collection";
import {
  Time,
  fromNanoSec,
  toNanoSec,
  compare as compareTime,
  isLessThan,
} from "@foxglove/rostime";
import {
  CompressedImage,
  RawImage,
  ImageAnnotations as FoxgloveImageAnnotations,
} from "@foxglove/schemas";
import { MessageEvent } from "@foxglove/studio";
import { normalizeAnnotations } from "@foxglove/studio-base/panels/Image/lib/normalizeAnnotations";
import { Annotation } from "@foxglove/studio-base/panels/Image/types";
import { ImageModeConfig } from "@foxglove/studio-base/panels/ThreeDeeRender/IRenderer";
import {
  AnyImage,
  getTimestampFromImage,
} from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/Images/ImageTypes";
import {
  normalizeCompressedImage,
  normalizeRawImage,
  normalizeRosCompressedImage,
  normalizeRosImage,
} from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/Images/imageNormalizers";
import { normalizeCameraInfo } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/projections";
import {
  ImageMarker as RosImageMarker,
  ImageMarkerArray as RosImageMarkerArray,
} from "@foxglove/studio-base/types/Messages";

import { PartialMessageEvent } from "../../SceneExtension";
import { CompressedImage as RosCompressedImage, Image as RosImage, CameraInfo } from "../../ros";

type NormalizedAnnotations = {
  // required for setting the original message on the renderable
  originalMessage: MessageEvent<RosImageMarkerArray | RosImageMarker | FoxgloveImageAnnotations>;
  annotations: Annotation[];
};

type SynchronizationItem = {
  image?: Readonly<MessageEvent<AnyImage>>;
  annotationsByTopicSchema: TwoKeyMap<string, string, NormalizedAnnotations>;
};

type Config = Pick<
  ImageModeConfig,
  "synchronize" | "annotations" | "calibrationTopic" | "imageTopic"
>;

type MessageHandlerState = {
  image?: MessageEvent<AnyImage>;
  cameraInfo?: CameraInfo;
  annotationsByTopicSchema: TwoKeyMap<string, string, NormalizedAnnotations>;
};

export type MessageRenderState = Readonly<Partial<MessageHandlerState>>;

type RenderStateListener = (
  newState: MessageRenderState,
  oldState: MessageRenderState | undefined,
) => void;

/**
 * Processes and normalizes incoming messages and manages state of
 * messages to be rendered given the ImageMode config. A large part of this responsibility
 * is managing state in synchronized mode and ensuring that the a synchronized set of image and
 * annotations are handed off to the SceneExtension for rendering.
 */
export class MessageHandler {
  /** settings that should reflect image mode config */
  #config: Immutable<Config>;

  /** last state passed to listeners */
  #oldRenderState: MessageRenderState | undefined;

  /** internal state of last received messages */
  #lastReceivedMessages: MessageHandlerState;

  /** sorted tree that holds state for synchronized messages. Used to find most recent synchronized set of image and annotations. */
  readonly #tree: AVLTree<Time, SynchronizationItem>;

  /** listener functions that are called when the state changes. */
  #listeners: RenderStateListener[] = [];

  /**
   *
   * @param config - subset of ImageMode settings required for message handling
   */
  public constructor(config: Immutable<Config>) {
    this.#config = config;
    this.#lastReceivedMessages = {
      annotationsByTopicSchema: new TwoKeyMap(),
    };
    this.#tree = new AVLTree<Time, SynchronizationItem>(compareTime);
  }
  /**
   *  Add listener that will trigger every time the state changes
   *  The listener will be called with the new state and the previous state.
   */
  public addListener(listener: RenderStateListener): void {
    this.#listeners.push(listener);
  }

  /** Remove listener from being called on state update */
  public removeListener(listener: RenderStateListener): void {
    this.#listeners = this.#listeners.filter((fn) => fn !== listener);
  }

  public handleRosRawImage = (messageEvent: PartialMessageEvent<RosImage>): void => {
    this.#handleImage(messageEvent, normalizeRosImage(messageEvent.message));
  };

  public handleRosCompressedImage = (
    messageEvent: PartialMessageEvent<RosCompressedImage>,
  ): void => {
    this.#handleImage(messageEvent, normalizeRosCompressedImage(messageEvent.message));
  };

  public handleRawImage = (messageEvent: PartialMessageEvent<RawImage>): void => {
    this.#handleImage(messageEvent, normalizeRawImage(messageEvent.message));
  };

  public handleCompressedImage = (messageEvent: PartialMessageEvent<CompressedImage>): void => {
    this.#handleImage(messageEvent, normalizeCompressedImage(messageEvent.message));
  };

  #handleImage(message: PartialMessageEvent<AnyImage>, image: AnyImage) {
    const normalizedImageMessage: MessageEvent<AnyImage> = {
      ...message,
      message: image,
    };

    if (this.#config.synchronize !== true) {
      this.#lastReceivedMessages.image = normalizedImageMessage;
      this.#emitState();
      return;
    }
    // Update the image at the stamp time
    const item = this.#tree.get(getTimestampFromImage(image));
    if (item) {
      item.image = normalizedImageMessage;
    } else {
      this.#tree.set(getTimestampFromImage(image), {
        image: normalizedImageMessage,
        annotationsByTopicSchema: new TwoKeyMap(),
      });
    }
    this.#emitState();
  }

  public handleCameraInfo = (message: PartialMessageEvent<CameraInfo>): void => {
    const cameraInfo = normalizeCameraInfo(message.message);
    this.#lastReceivedMessages.cameraInfo = cameraInfo;
    this.#emitState();
  };

  public handleAnnotations = (
    messageEvent: MessageEvent<FoxgloveImageAnnotations | RosImageMarker | RosImageMarkerArray>,
  ): void => {
    const annotations = normalizeAnnotations(messageEvent.message, messageEvent.schemaName);

    if (!annotations) {
      return;
    }

    const { topic, schemaName } = messageEvent;
    if (this.#config.synchronize !== true) {
      this.#lastReceivedMessages.annotationsByTopicSchema.set(topic, schemaName, {
        originalMessage: messageEvent,
        annotations,
      });
      this.#emitState();
      return;
    }
    const groups = new Map<bigint, Annotation[]>();

    for (const annotation of annotations) {
      const key = toNanoSec(annotation.stamp);
      const arr = groups.get(key);
      if (arr) {
        arr.push(annotation);
        continue;
      }
      groups.set(key, [annotation]);
    }

    for (const [stampNsec, group] of groups) {
      const stamp = fromNanoSec(stampNsec);
      let item = this.#tree.get(stamp);
      if (!item) {
        item = {
          image: undefined,
          annotationsByTopicSchema: new TwoKeyMap(),
        };
        this.#tree.set(stamp, item);
      }
      item.annotationsByTopicSchema.set(topic, schemaName, {
        originalMessage: messageEvent,
        annotations: group,
      });
    }

    this.#emitState();
  };

  public setConfig(newConfig: Immutable<Partial<ImageModeConfig>>): void {
    let changed = false;

    if (newConfig.synchronize != undefined && newConfig.synchronize !== this.#config.synchronize) {
      this.#tree.clear();
      changed = true;
    }

    if ("imageTopic" in newConfig && this.#config.imageTopic !== newConfig.imageTopic) {
      for (const item of this.#tree.values()) {
        item.image = undefined;
      }
      this.#lastReceivedMessages.image = undefined;
      changed = true;
    }

    if (
      "calibrationTopic" in newConfig &&
      this.#config.calibrationTopic !== newConfig.calibrationTopic
    ) {
      this.#lastReceivedMessages.cameraInfo = undefined;
      changed = true;
    }

    if (
      newConfig.annotations != undefined &&
      this.#config.annotations &&
      this.#config.annotations !== newConfig.annotations
    ) {
      const newVisibleAnnotationsMap = new TwoKeyMap<string, string, boolean>();

      newConfig.annotations.forEach(
        ({ topic, schemaName, settings }) =>
          settings.visible && newVisibleAnnotationsMap.set(topic, schemaName, settings.visible),
      );

      for (const [
        topic,
        schemaName,
      ] of this.#lastReceivedMessages.annotationsByTopicSchema.keys()) {
        if (newVisibleAnnotationsMap.get(topic, schemaName) == undefined) {
          this.#lastReceivedMessages.annotationsByTopicSchema.delete(topic, schemaName);
          changed = true;
        }
      }
      for (const syncEntry of this.#tree.values()) {
        for (const [topic, schemaName] of syncEntry.annotationsByTopicSchema.keys()) {
          if (newVisibleAnnotationsMap.get(topic, schemaName) == undefined) {
            syncEntry.annotationsByTopicSchema.delete(topic, schemaName);
            changed = true;
          }
        }
      }
    }

    this.#config = {
      ...this.#config,
      ...newConfig,
    };

    if (changed) {
      this.#emitState();
    }
  }

  public clear(): void {
    this.#lastReceivedMessages = {
      annotationsByTopicSchema: new TwoKeyMap(),
    };
    this.#tree.clear();
    this.#oldRenderState = undefined;
    this.#emitState();
  }

  #emitState() {
    const state = this.getRenderState();
    this.#listeners.forEach((fn) => fn(state, this.#oldRenderState));
    this.#oldRenderState = state;
  }

  /** Do not use. only public for testing */
  public getRenderState(): Readonly<Partial<MessageHandlerState>> {
    if (this.#config.synchronize === true) {
      const validEntry = findSynchronizedSetAndRemoveOlderItems(
        this.#tree,
        this.#visibleAnnotationsMap(),
      );
      if (validEntry) {
        return {
          cameraInfo: this.#lastReceivedMessages.cameraInfo,
          image: validEntry[1].image,
          annotationsByTopicSchema: validEntry[1].annotationsByTopicSchema,
        };
      }
      return {
        cameraInfo: this.#lastReceivedMessages.cameraInfo,
      };
    }

    return { ...this.#lastReceivedMessages };
  }

  #visibleAnnotationsMap(): TwoKeyMap<string, string, boolean> {
    const map = new TwoKeyMap<string, string, true>();

    this.#config.annotations?.forEach(
      ({ topic, schemaName, settings }) =>
        settings.visible && map.set(topic, schemaName, settings.visible),
    );
    return map;
  }
}

/**
 * Find the newest entry where we have everything synchronized and remove all older entries from tree.
 * @param tree - AVL tree that stores a [image?, annotations?] in sorted order by timestamp.
 * @param visibleAnnotationsMap - visible topic schema pairs mapped to true boolean values
 * @returns - the newest synchronized item with all active annotations and image, or undefined if none found
 */
export function findSynchronizedSetAndRemoveOlderItems(
  tree: AVLTree<Time, SynchronizationItem>,
  visibleAnnotationsMap: TwoKeyMap<string, string, boolean>,
): [Time, SynchronizationItem] | undefined {
  let validEntry: [Time, SynchronizationItem] | undefined = undefined;
  for (const entry of tree.entries()) {
    const messageState = entry[1];
    const hasOnlyVisibleAnnotations =
      visibleAnnotationsMap.size === messageState.annotationsByTopicSchema.size &&
      Array.from(visibleAnnotationsMap.keys()).every(
        ([topic, schemaName]) =>
          messageState.annotationsByTopicSchema.get(topic, schemaName) != undefined,
      );
    // If we have an image and all the messages for annotation topics then we have a synchronized set.
    if (messageState.image && hasOnlyVisibleAnnotations) {
      validEntry = entry;
    }
  }

  if (validEntry) {
    // We've got a set of synchronized messages, remove any older items from the tree
    let minKey = tree.minKey();
    while (minKey && isLessThan(minKey, validEntry[0])) {
      tree.shift();
      minKey = tree.minKey();
    }
  }

  return validEntry;
}
