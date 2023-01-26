// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { flatten } from "lodash";
import { useCallback, useMemo } from "react";

import { AVLTree } from "@foxglove/avl";
import { useShallowMemo } from "@foxglove/hooks";
import {
  Time,
  compare as compareTime,
  isLessThan,
  toNanoSec,
  fromNanoSec,
} from "@foxglove/rostime";
import { MessageEvent } from "@foxglove/studio";
import { useMessageReducer } from "@foxglove/studio-base/PanelAPI";

import { useDatatypesByTopic } from "./useDatatypesByTopic";
import { normalizeAnnotations } from "../lib/normalizeAnnotations";
import { normalizeImageMessage } from "../lib/normalizeMessage";
import { Annotation, NormalizedImageMessage } from "../types";

export type ImagePanelMessages = {
  image?: NormalizedImageMessage;
  annotations?: Annotation[];
};

export type SynchronizationItem = {
  image?: NormalizedImageMessage;
  annotationsByTopic: Map<string, Annotation[]>;
};

type ReducerState = {
  imageTopic?: string;
  image?: NormalizedImageMessage;
  annotationsByTopic: Map<string, Annotation[]>;

  tree: AVLTree<Time, SynchronizationItem>;
};

export const ANNOTATION_DATATYPES = [
  // Single marker
  "visualization_msgs/ImageMarker",
  "visualization_msgs/msg/ImageMarker",
  "ros.visualization_msgs.ImageMarker",
  // Marker arrays
  "foxglove_msgs/ImageMarkerArray",
  "foxglove_msgs/msg/ImageMarkerArray",
  "studio_msgs/ImageMarkerArray",
  "studio_msgs/msg/ImageMarkerArray",
  "visualization_msgs/ImageMarkerArray",
  "visualization_msgs/msg/ImageMarkerArray",
  "ros.visualization_msgs.ImageMarkerArray",
  // backwards compat with webviz
  "webviz_msgs/ImageMarkerArray",
  // foxglove
  "foxglove_msgs/ImageAnnotations",
  "foxglove_msgs/msg/ImageAnnotations",
  "foxglove.ImageAnnotations",
] as const;

type Options = {
  imageTopic: string;
  annotationTopics: string[];
  synchronize: boolean;
};

export function synchronizedAddMessage(
  state: ReducerState,
  args: { datatype: string; event: MessageEvent<unknown>; annotationTopics: string[] },
): ReducerState {
  const {
    datatype,
    annotationTopics,
    event: { topic, message },
  } = args;

  const image = normalizeImageMessage(message, datatype);
  const annotations = normalizeAnnotations(message, datatype);

  if (!image && !annotations) {
    return state;
  }

  // Update the image at the stamp time
  if (image) {
    const item = state.tree.get(image.stamp) ?? {
      image: undefined,
      annotationsByTopic: new Map(),
    };
    item.image = image;
    state.tree.set(image.stamp, item);
  }

  // Update annotations at the stamp time
  if (annotations) {
    // If we know all the annotations are the same timestamp, we can shortcut
    // and set the annotations by topic directly for the single stamp
    let sameStamp = annotations[0]?.stamp;
    for (const annotation of annotations) {
      if (!sameStamp || compareTime(annotation.stamp, sameStamp) !== 0) {
        sameStamp = undefined;
        break;
      }
    }

    if (sameStamp) {
      const item = state.tree.get(sameStamp) ?? {
        image: undefined,
        annotationsByTopic: new Map(),
      };
      item.annotationsByTopic.set(topic, annotations);
      state.tree.set(sameStamp, item);
    } else {
      // Annotations have different timestamps. This means we have to group them by stamp.
      // Then for each stamp, we update the annotations by topic at that stamp.

      const groups = new Map<bigint, Annotation[]>();
      for (const annotation of annotations) {
        const key = toNanoSec(annotation.stamp);
        const arr = groups.get(key) ?? [];
        arr.push(annotation);
        groups.set(key, arr);
      }

      for (const entry of groups.entries()) {
        const stamp = fromNanoSec(entry[0]);
        const item = state.tree.get(stamp) ?? {
          image: undefined,
          annotationsByTopic: new Map(),
        };
        item.annotationsByTopic.set(topic, entry[1]);
        state.tree.set(stamp, item);
      }
    }
  }

  // Find the oldest entry where we have everything synchronized
  let validEntry: [Time, SynchronizationItem] | undefined = undefined;
  for (const entry of state.tree.entries()) {
    const messageState = entry[1];
    // If we have an image and all the messages for annotation topics then we have a synchronized set.
    if (messageState.image && messageState.annotationsByTopic.size === annotationTopics.length) {
      validEntry = entry;
    }
  }

  // We've got a set of synchronized messages, remove any older items from the tree
  if (validEntry) {
    let minKey = state.tree.minKey();
    while (minKey && isLessThan(minKey, validEntry[0])) {
      state.tree.shift();

      minKey = state.tree.minKey();
    }

    return {
      imageTopic: state.imageTopic,
      image: validEntry[1].image,
      annotationsByTopic: validEntry[1].annotationsByTopic,
      tree: state.tree,
    };
  }

  // with no valid entry, we keep the previous state
  return state;
}

function useImagePanelMessages(options?: Options): ImagePanelMessages {
  const { imageTopic, annotationTopics, synchronize = false } = options ?? {};

  const topics = useMemo(() => {
    const out: string[] = [];
    if (imageTopic) {
      out.push(imageTopic);
    }
    if (annotationTopics) {
      out.push(...annotationTopics);
    }
    return out;
  }, [annotationTopics, imageTopic]);

  const shallowTopics = useShallowMemo(topics);

  const datatypesByTopic = useDatatypesByTopic();

  const restore = useCallback(
    (state?: ReducerState) => {
      // When changing image topics, clear the image and any annotations
      if (!state || state.imageTopic !== imageTopic) {
        return {
          annotationsByTopic: new Map(),
          tree: new AVLTree<Time, SynchronizationItem>(compareTime),
        };
      }
      return state;
    },
    [imageTopic],
  );

  const addMessage = useCallback(
    (state: ReducerState, event: MessageEvent<unknown>): ReducerState => {
      // A datatype is required to normalize the message
      const datatype = datatypesByTopic.get(event.topic);
      if (!datatype) {
        return state;
      }

      if (synchronize && annotationTopics) {
        return synchronizedAddMessage(state, {
          annotationTopics,
          datatype,
          event,
        });
      }

      const normalizedImage = normalizeImageMessage(event.message, datatype);
      const normalizedAnnotations = normalizeAnnotations(event.message, datatype);

      if (!normalizedImage && !normalizedAnnotations) {
        return state;
      }

      let annotationsByTopic = state.annotationsByTopic;

      if (normalizedAnnotations) {
        annotationsByTopic.set(event.topic, normalizedAnnotations);
        annotationsByTopic = new Map(annotationsByTopic);
      }

      return {
        imageTopic: state.imageTopic,
        image: normalizedImage ?? state.image,
        annotationsByTopic,
        tree: state.tree,
      };
    },
    [annotationTopics, datatypesByTopic, synchronize],
  );

  const { image, annotationsByTopic } = useMessageReducer({
    topics: shallowTopics,
    restore,
    addMessage,
  });

  return useMemo(() => {
    const annotations = flatten(Array.from(annotationsByTopic.values()));
    return {
      image,
      annotations,
    };
  }, [annotationsByTopic, image]);
}

export { useImagePanelMessages };
