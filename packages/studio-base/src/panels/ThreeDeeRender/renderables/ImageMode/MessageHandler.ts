// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";

import { AVLTree } from "@foxglove/avl";
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
import { Immutable, MessageEvent } from "@foxglove/studio";
import {
  HUDItem,
  HUDItemManager,
} from "@foxglove/studio-base/panels/ThreeDeeRender/HUDItemManager";
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

import { normalizeAnnotations } from "./annotations/normalizeAnnotations";
import { Annotation } from "./annotations/types";
import {
  IMAGE_MODE_HUD_GROUP_ID,
  WAITING_FOR_BOTH_MESSAGES_HUD_ID,
  WAITING_FOR_CALIBRATION_HUD_ID,
  WAITING_FOR_IMAGES_NOTICE_ID,
  WAITING_FOR_IMAGES_EMPTY_HUD_ID,
  WAITING_FOR_SYNC_NOTICE_HUD_ID,
  WAITING_FOR_SYNC_EMPTY_HUD_ID,
} from "./constants";
import { PartialMessageEvent } from "../../SceneExtension";
import { CompressedImage as RosCompressedImage, Image as RosImage, CameraInfo } from "../../ros";
import { t3D } from "../../t3D";

type NormalizedAnnotations = {
  // required for setting the original message on the renderable
  originalMessage: MessageEvent<RosImageMarkerArray | RosImageMarker | FoxgloveImageAnnotations>;
  annotations: Annotation[];
};

type SynchronizationItem = {
  image?: Readonly<MessageEvent<AnyImage>>;
  annotationsByTopic: Map<string, NormalizedAnnotations>;
};

type Config = Pick<
  ImageModeConfig,
  "synchronize" | "annotations" | "calibrationTopic" | "imageTopic"
>;

type MessageHandlerState = {
  image?: MessageEvent<AnyImage>;
  cameraInfo?: CameraInfo;
  annotationsByTopic: Map<string, NormalizedAnnotations>;

  /** Topics that were present in a potential synchronized set */
  presentAnnotationTopics?: string[];
  /** Topics that were missing so that a synchronized set could not be found */
  missingAnnotationTopics?: string[];
};

export type MessageRenderState = Readonly<Partial<MessageHandlerState>>;

type RenderStateListener = (
  newState: MessageRenderState,
  oldState: MessageRenderState | undefined,
) => void;

// Have constants for the HUD items so that they don't need to be recreated and GCed every message
export const WAITING_FOR_BOTH_HUD_ITEM: HUDItem = {
  id: WAITING_FOR_BOTH_MESSAGES_HUD_ID,
  group: IMAGE_MODE_HUD_GROUP_ID,
  getMessage: () => t3D("waitingForCalibrationAndImages"),
  displayType: "empty",
};

export const WAITING_FOR_CALIBRATION_HUD_ITEM: HUDItem = {
  id: WAITING_FOR_CALIBRATION_HUD_ID,
  group: IMAGE_MODE_HUD_GROUP_ID,
  getMessage: () => t3D("waitingForCalibration"),
  displayType: "empty",
};

export const WAITING_FOR_IMAGE_NOTICE_HUD_ITEM: HUDItem = {
  id: WAITING_FOR_IMAGES_NOTICE_ID,
  group: IMAGE_MODE_HUD_GROUP_ID,
  getMessage: () => t3D("waitingForImages"),
  displayType: "notice",
};

export const WAITING_FOR_IMAGE_EMPTY_HUD_ITEM: HUDItem = {
  id: WAITING_FOR_IMAGES_EMPTY_HUD_ID,
  group: IMAGE_MODE_HUD_GROUP_ID,
  getMessage: () => t3D("waitingForImages"),
  displayType: "empty",
};

export const WAITING_FOR_SYNC_NOTICE_HUD_ITEM: HUDItem = {
  id: WAITING_FOR_SYNC_NOTICE_HUD_ID,
  group: IMAGE_MODE_HUD_GROUP_ID,
  getMessage: () => t3D("waitingForSyncAnnotations"),
  displayType: "notice",
};

export const WAITING_FOR_SYNC_EMPTY_HUD_ITEM: HUDItem = {
  id: WAITING_FOR_SYNC_EMPTY_HUD_ID,
  group: IMAGE_MODE_HUD_GROUP_ID,
  getMessage: () => t3D("waitingForSyncAnnotations"),
  displayType: "empty",
};
/**
 * Processes and normalizes incoming messages and manages state of
 * messages to be rendered given the ImageMode config. A large part of this responsibility
 * is managing state in synchronized mode and ensuring that the a synchronized set of image and
 * annotations are handed off to the SceneExtension for rendering.
 */
export class MessageHandler implements IMessageHandler {
  /** settings that should reflect image mode config */
  #config: Immutable<Config>;

  /** Allows message handler push messages to overlay on top of the canvas */
  #hud: HUDItemManager;

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
  public constructor(config: Immutable<Config>, hud: HUDItemManager) {
    this.#config = config;
    this.#hud = hud;
    this.#lastReceivedMessages = {
      annotationsByTopic: new Map(),
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
    this.handleImage(messageEvent, normalizeRosImage(messageEvent.message));
  };

  public handleRosCompressedImage = (
    messageEvent: PartialMessageEvent<RosCompressedImage>,
  ): void => {
    this.handleImage(messageEvent, normalizeRosCompressedImage(messageEvent.message));
  };

  public handleRawImage = (messageEvent: PartialMessageEvent<RawImage>): void => {
    this.handleImage(messageEvent, normalizeRawImage(messageEvent.message));
  };

  public handleCompressedImage = (messageEvent: PartialMessageEvent<CompressedImage>): void => {
    this.handleImage(messageEvent, normalizeCompressedImage(messageEvent.message));
  };

  protected handleImage(message: PartialMessageEvent<AnyImage>, image: AnyImage): void {
    const normalizedImageMessage: MessageEvent<AnyImage> = {
      ...message,
      message: image,
    };

    this.#lastReceivedMessages.image = normalizedImageMessage;
    if (this.#config.synchronize !== true) {
      this.#emitState();
      return;
    }
    // Update the image at the stamp time
    this.#addImageToTree(normalizedImageMessage);
    this.#emitState();
  }

  #addImageToTree(normalizedImageMessage: MessageEvent<AnyImage>) {
    const image = normalizedImageMessage.message;
    const item = this.#tree.get(getTimestampFromImage(image));
    if (item) {
      item.image = normalizedImageMessage;
    } else {
      this.#tree.set(getTimestampFromImage(image), {
        image: normalizedImageMessage,
        annotationsByTopic: new Map(),
      });
    }
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

    const { topic } = messageEvent;
    if (this.#config.synchronize !== true) {
      this.#lastReceivedMessages.annotationsByTopic.set(topic, {
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
          annotationsByTopic: new Map(),
        };
        this.#tree.set(stamp, item);
      }
      item.annotationsByTopic.set(topic, {
        originalMessage: messageEvent,
        annotations: group,
      });
    }

    this.#emitState();
  };

  public setConfig(newConfig: Immutable<ImageModeConfig>): void {
    let changed = false;

    if (newConfig.synchronize != undefined && newConfig.synchronize !== this.#config.synchronize) {
      this.#oldRenderState = undefined;
      this.#tree.clear();
      if (newConfig.synchronize && this.#lastReceivedMessages.image != undefined) {
        this.#addImageToTree(this.#lastReceivedMessages.image);
      }

      changed = true;
    }

    if ("imageTopic" in newConfig && this.#config.imageTopic !== newConfig.imageTopic) {
      for (const item of this.#tree.values()) {
        item.image = undefined;
      }
      this.#lastReceivedMessages.image = undefined;
      changed = true;
    }

    if (this.#config.calibrationTopic !== newConfig.calibrationTopic) {
      this.#lastReceivedMessages.cameraInfo = undefined;
      changed = true;
    }

    if (
      newConfig.annotations != undefined &&
      this.#config.annotations &&
      this.#config.annotations !== newConfig.annotations
    ) {
      const newVisibleTopics = new Set<string>();

      for (const [topic, settings] of Object.entries(newConfig.annotations)) {
        if (settings?.visible === true) {
          newVisibleTopics.add(topic);
        }
      }

      for (const topic of this.#lastReceivedMessages.annotationsByTopic.keys()) {
        if (!newVisibleTopics.has(topic)) {
          this.#lastReceivedMessages.annotationsByTopic.delete(topic);
          changed = true;
        }
      }
      for (const syncEntry of this.#tree.values()) {
        for (const topic of syncEntry.annotationsByTopic.keys()) {
          if (!newVisibleTopics.has(topic)) {
            syncEntry.annotationsByTopic.delete(topic);
            changed = true;
          }
        }
      }
    }

    this.#config = newConfig;

    if (changed) {
      this.#emitState();
    }
  }

  public clear(): void {
    this.#lastReceivedMessages = {
      annotationsByTopic: new Map(),
    };
    this.#tree.clear();
    this.#oldRenderState = undefined;
    this.#emitState();
  }

  #emitState() {
    const state = this.getRenderStateAndUpdateHUD();

    this.#listeners.forEach((fn) => {
      fn(state, this.#oldRenderState);
    });
    this.#oldRenderState = state;
  }

  /** Do not use. only public for testing */
  public getRenderStateAndUpdateHUD(): Readonly<Partial<MessageHandlerState>> {
    const state = this.#getRenderState();
    this.#updateHUDFromState(state);
    return state;
  }

  #updateHUDFromState(state: MessageRenderState): void {
    const calibrationRequired = this.#config.calibrationTopic != undefined;

    const waitingForImage =
      this.#lastReceivedMessages.image == undefined && state.image == undefined;

    const waitingForCalibration = calibrationRequired && state.cameraInfo == undefined;

    const waitingForBoth = waitingForImage && waitingForCalibration;

    this.#hud.displayIfTrue(waitingForBoth, WAITING_FOR_BOTH_HUD_ITEM);

    // don't show other empty states when waiting for both to reduce noise
    this.#hud.displayIfTrue(
      waitingForCalibration && !waitingForBoth,
      WAITING_FOR_CALIBRATION_HUD_ITEM,
    );
    this.#hud.displayIfTrue(
      waitingForImage && !calibrationRequired && !waitingForBoth,
      WAITING_FOR_IMAGE_EMPTY_HUD_ITEM,
    );
    this.#hud.displayIfTrue(
      waitingForImage && calibrationRequired,
      WAITING_FOR_IMAGE_NOTICE_HUD_ITEM,
    );

    const waitingForSync =
      !!state.missingAnnotationTopics && state.missingAnnotationTopics.length > 0;
    this.#hud.displayIfTrue(
      waitingForSync && calibrationRequired,
      WAITING_FOR_SYNC_NOTICE_HUD_ITEM,
    );

    // it is an empty state if calibration not required
    this.#hud.displayIfTrue(
      waitingForSync && !calibrationRequired,
      WAITING_FOR_SYNC_EMPTY_HUD_ITEM,
    );
  }

  #getRenderState(): Readonly<Partial<MessageHandlerState>> {
    if (this.#config.synchronize === true) {
      const result = findSynchronizedSetAndRemoveOlderItems(this.#tree, this.#visibleAnnotations());
      if (result.found) {
        return {
          cameraInfo: this.#lastReceivedMessages.cameraInfo,
          image: result.messages.image,
          annotationsByTopic: result.messages.annotationsByTopic,
        };
      }
      return {
        cameraInfo: this.#lastReceivedMessages.cameraInfo,
        presentAnnotationTopics: result.presentAnnotationTopics,
        missingAnnotationTopics: result.missingAnnotationTopics,
      };
    }
    return { ...this.#lastReceivedMessages };
  }

  #visibleAnnotations(): Set<string> {
    const visibleAnnotations = new Set<string>();
    for (const [topic, settings] of Object.entries(this.#config.annotations ?? {})) {
      if (settings?.visible === true) {
        visibleAnnotations.add(topic);
      }
    }
    return visibleAnnotations;
  }
}

export interface IMessageHandler {
  handleRosRawImage: (messageEvent: PartialMessageEvent<RosImage>) => void;
  handleRosCompressedImage: (messageEvent: PartialMessageEvent<RosCompressedImage>) => void;
  handleRawImage: (messageEvent: PartialMessageEvent<RawImage>) => void;
  handleCompressedImage: (messageEvent: PartialMessageEvent<CompressedImage>) => void;
  handleCameraInfo: (message: PartialMessageEvent<CameraInfo>) => void;
  handleAnnotations: (
    messageEvent: MessageEvent<FoxgloveImageAnnotations | RosImageMarker | RosImageMarkerArray>,
  ) => void;
  addListener(listener: RenderStateListener): void;
  removeListener(listener: RenderStateListener): void;
  setConfig(newConfig: Immutable<Partial<ImageModeConfig>>): void;
  clear(): void;
  getRenderStateAndUpdateHUD(): Readonly<Partial<MessageHandlerState>>;
}

type SynchronizationResult =
  | {
      found: true;
      /** Synchronized set of messages found with matching timestamps */
      messages: SynchronizationItem;
    }
  | {
      found: false;
      /**
       * Annotations that were present at the matching timestamp.
       */
      presentAnnotationTopics: string[] | undefined;
      /**
       * Annotations that were missing and caused there to be no synchronized set, or undefined if no
       * images were received at all.
       */
      missingAnnotationTopics: string[] | undefined;
    };

/**
 * Find the newest entry where we have everything synchronized and remove all older entries from tree.
 * @param tree - AVL tree that stores a [image?, annotations?] in sorted order by timestamp.
 * @param visibleAnnotations - visible annotation topics
 * @returns - the newest synchronized item with all active annotations and image, or set of missing annotations if synchronization failed
 */
function findSynchronizedSetAndRemoveOlderItems(
  tree: AVLTree<Time, SynchronizationItem>,
  visibleAnnotations: Set<string>,
): SynchronizationResult {
  let validEntry: [Time, SynchronizationItem] | undefined = undefined;
  let presentAnnotationTopics: string[] | undefined;
  let missingAnnotationTopics: string[] | undefined;
  for (const entry of tree.entries()) {
    const messageState = entry[1];
    if (!messageState.image) {
      continue;
    }
    [presentAnnotationTopics, missingAnnotationTopics] = _.partition(
      Array.from(visibleAnnotations),
      (topic) => messageState.annotationsByTopic.has(topic),
    );

    // If we have an image and all the messages for annotation topics then we have a synchronized set.
    if (missingAnnotationTopics.length === 0) {
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
    return { found: true, messages: validEntry[1] };
  }

  return { found: false, missingAnnotationTopics, presentAnnotationTopics };
}
