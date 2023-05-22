// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AVLTree } from "@foxglove/avl";
import { Time, isLessThan, toNanoSec, fromNanoSec } from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";

import { normalizeCameraInfo } from "./normalizeCameraInfo";
import { normalizeAnnotations } from "../lib/normalizeAnnotations";
import { normalizeImageMessage } from "../lib/normalizeMessage";
import type { Annotation, ImagePanelState, SynchronizationItem } from "../types";

export function synchronizedAddMessages(
  state: Pick<ImagePanelState, "imageTopic" | "cameraInfoTopic" | "annotationTopics" | "tree">,
  messageEvents: readonly MessageEvent[],
): Partial<ImagePanelState> {
  let newState: Partial<ImagePanelState> | undefined;

  for (const event of messageEvents) {
    const cameraInfo =
      event.topic === state.cameraInfoTopic
        ? normalizeCameraInfo(event.message, event.schemaName)
        : undefined;

    const image =
      event.topic === state.imageTopic
        ? normalizeImageMessage(event.message, event.schemaName)
        : undefined;
    const annotations = normalizeAnnotations(event.message, event.schemaName);
    if (!cameraInfo && !image && !annotations) {
      continue;
    }

    if (cameraInfo) {
      newState ??= {};
      newState.cameraInfo = cameraInfo;
    }

    if (image) {
      // Update the image at the stamp time
      const item = state.tree.get(image.stamp);
      if (item) {
        item.image = image;
      } else {
        state.tree.set(image.stamp, {
          image,
          annotationsByTopic: new Map(),
        });
      }
    }

    if (annotations) {
      // Group annotations by timestamp, then update the annotations by topic at each stamp
      const groups = new Map<bigint, Annotation[]>();
      for (const annotation of annotations) {
        const key = toNanoSec(annotation.stamp);
        const arr = groups.get(key);
        if (arr) {
          arr.push(annotation);
        } else {
          groups.set(key, [annotation]);
        }
      }

      for (const [stampNsec, group] of groups) {
        const stamp = fromNanoSec(stampNsec);
        let item = state.tree.get(stamp);
        if (!item) {
          item = {
            image: undefined,
            annotationsByTopic: new Map(),
          };
          state.tree.set(stamp, item);
        }
        item.annotationsByTopic.set(event.topic, group);
      }
    }

    const validEntry = findSynchronizedSetAndRemoveOlderItems(state.tree, state.annotationTopics);
    if (validEntry) {
      newState ??= {};
      newState.image = validEntry[1].image;
      newState.annotationsByTopic = validEntry[1].annotationsByTopic;
    }
  }

  // with no valid entry, we keep the previous state
  return newState ?? state;
}

/** Find the newest entry where we have everything synchronized */
export function findSynchronizedSetAndRemoveOlderItems(
  tree: AVLTree<Time, SynchronizationItem>,
  annotationTopics: readonly string[],
): [Time, SynchronizationItem] | undefined {
  let validEntry: [Time, SynchronizationItem] | undefined = undefined;
  for (const entry of tree.entries()) {
    const messageState = entry[1];
    // If we have an image and all the messages for annotation topics then we have a synchronized set.
    if (messageState.image && messageState.annotationsByTopic.size === annotationTopics.length) {
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
