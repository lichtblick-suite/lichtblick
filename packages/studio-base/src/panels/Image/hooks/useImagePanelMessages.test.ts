// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AVLTree } from "@foxglove/avl";
import { Time, compare as compareTime, toNanoSec } from "@foxglove/rostime";
import { ImageAnnotations } from "@foxglove/schemas/schemas/typescript";
import { FoxgloveMessages } from "@foxglove/studio-base/types/FoxgloveMessages";

import { synchronizedAddMessage, SynchronizationItem } from "./useImagePanelMessages";

function EmptyState() {
  return {
    annotationsByTopic: new Map(),
    tree: new AVLTree<Time, SynchronizationItem>(compareTime),
  };
}

function GenerateImage(stamp: Time): FoxgloveMessages["foxglove.CompressedImage"] {
  return {
    timestamp: toNanoSec(stamp),
    format: "format",
    data: new Uint8Array(0),
  };
}

function GenerateAnnotations(stamp: Time): ImageAnnotations {
  return {
    circles: [
      {
        timestamp: stamp,
        diameter: 1,
        position: { x: 0, y: 0 },
        thickness: 1,
        outline_color: { r: 0, g: 0, b: 0, a: 1 },
        fill_color: { r: 0, g: 0, b: 0, a: 1 },
      },
    ],
    points: [],
  };
}

describe("synchronizedAddMessage", () => {
  it("should return the same state when no images or annotations provided", () => {
    const state = EmptyState();
    const newState = synchronizedAddMessage(state, {
      datatype: "dummy",
      event: {
        topic: "/foo",
        receiveTime: { sec: 0, nsec: 0 },
        message: {},
        sizeInBytes: 0,
      },
      annotationTopics: [],
    });
    expect(newState).toEqual(state);
  });

  it("stores unsynchronized image message", () => {
    const state = EmptyState();

    const image = GenerateImage({ sec: 1, nsec: 0 });
    const newState = synchronizedAddMessage(state, {
      datatype: "foxglove.CompressedImage",
      event: {
        topic: "/foo",
        receiveTime: { sec: 0, nsec: 0 },
        message: image,
        sizeInBytes: 0,
      },
      annotationTopics: ["/annotation"],
    });

    // There's no synchronization, so we return the same state
    expect(newState).toEqual(state);

    expect(newState.tree.minKey()).toEqual({ sec: 1, nsec: 0 });
  });

  it("stores unsynchronized image message and unsynchronized annotations", () => {
    const state = EmptyState();

    {
      const image = GenerateImage({ sec: 1, nsec: 0 });
      const newState = synchronizedAddMessage(state, {
        datatype: "foxglove.CompressedImage",
        event: {
          topic: "/foo",
          receiveTime: { sec: 0, nsec: 0 },
          message: image,
          sizeInBytes: 0,
        },
        annotationTopics: ["/annotation"],
      });
      // There's no synchronization, so we return the same state
      expect(newState).toEqual(state);

      expect(newState.tree.minKey()).toEqual({ sec: 1, nsec: 0 });
      expect(newState.tree.maxKey()).toEqual({ sec: 1, nsec: 0 });
    }

    {
      const annotations = GenerateAnnotations({ sec: 2, nsec: 0 });
      const newState = synchronizedAddMessage(state, {
        datatype: "foxglove.ImageAnnotations",
        event: {
          topic: "/annotation",
          receiveTime: { sec: 0, nsec: 0 },
          message: annotations,
          sizeInBytes: 0,
        },
        annotationTopics: ["/annotation"],
      });
      // There's no synchronization, so we return the same state
      expect(newState).toEqual(state);

      expect(newState.tree.minKey()).toEqual({ sec: 1, nsec: 0 });
      expect(newState.tree.maxKey()).toEqual({ sec: 2, nsec: 0 });
    }
  });

  it("produces results when getting synchronized messages and removes old messages", () => {
    const state = EmptyState();

    {
      const image = GenerateImage({ sec: 1, nsec: 0 });
      const newState = synchronizedAddMessage(state, {
        datatype: "foxglove.CompressedImage",
        event: {
          topic: "/foo",
          receiveTime: { sec: 0, nsec: 0 },
          message: image,
          sizeInBytes: 0,
        },
        annotationTopics: ["/annotation"],
      });
      // There's no synchronization, so we return the same state
      expect(newState).toEqual(state);
    }

    {
      const annotations = GenerateAnnotations({ sec: 2, nsec: 0 });
      const newState = synchronizedAddMessage(state, {
        datatype: "foxglove.ImageAnnotations",
        event: {
          topic: "/annotation",
          receiveTime: { sec: 0, nsec: 0 },
          message: annotations,
          sizeInBytes: 0,
        },
        annotationTopics: ["/annotation"],
      });
      // There's no synchronization, so we return the same state
      expect(newState).toEqual(state);
    }

    {
      const image = GenerateImage({ sec: 2, nsec: 0 });
      const newState = synchronizedAddMessage(state, {
        datatype: "foxglove.CompressedImage",
        event: {
          topic: "/foo",
          receiveTime: { sec: 0, nsec: 0 },
          message: image,
          sizeInBytes: 0,
        },
        annotationTopics: ["/annotation"],
      });

      expect(newState.image).toEqual({
        data: new Uint8Array(),
        format: "format",
        stamp: {
          nsec: 0,
          sec: 2,
        },
        type: "compressed",
      });
      expect(newState.annotationsByTopic).toEqual(
        new Map(
          Object.entries({
            "/annotation": [
              {
                fillColor: { r: 0, g: 0, b: 0, a: 1 },
                outlineColor: { a: 1, b: 0, g: 0, r: 0 },
                position: { x: 0, y: 0 },
                radius: 0.5,
                stamp: { nsec: 0, sec: 2 },
                thickness: 1,
                type: "circle",
              },
            ],
          }),
        ),
      );

      expect(newState.tree.minKey()).toEqual({ sec: 2, nsec: 0 });
      expect(newState.tree.maxKey()).toEqual({ sec: 2, nsec: 0 });
    }
  });
});
