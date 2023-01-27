// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AVLTree } from "@foxglove/avl";
import { Time, compare as compareTime } from "@foxglove/rostime";
import { CompressedImage, ImageAnnotations } from "@foxglove/schemas";

import { synchronizedAddMessages } from "./synchronizedAddMessages";
import { SynchronizationItem, ImagePanelState } from "./useImagePanelMessages";

function emptyState(): Parameters<typeof synchronizedAddMessages>[0] {
  return {
    tree: new AVLTree<Time, SynchronizationItem>(compareTime),
    annotationTopics: [],
    imageTopic: "/foo",
    cameraInfoTopic: undefined,
  };
}

function generateImage(stamp: Time): CompressedImage {
  return {
    timestamp: stamp,
    frame_id: "",
    format: "format",
    data: new Uint8Array(0),
  };
}

function generateAnnotations(stamp: Time): ImageAnnotations {
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

describe("synchronizedAddMessages", () => {
  it("should return the same state when no images or annotations provided", () => {
    const state = emptyState();
    const newState = synchronizedAddMessages(state, [
      {
        topic: "/foo",
        receiveTime: { sec: 0, nsec: 0 },
        message: {},
        schemaName: "dummy",
        sizeInBytes: 0,
      },
    ]);
    expect(newState).toEqual(state);
  });

  it("stores unsynchronized image message", () => {
    const state = { ...emptyState(), annotationTopics: ["/annotation"] };

    const image = generateImage({ sec: 1, nsec: 0 });
    const newState = synchronizedAddMessages(state, [
      {
        topic: "/foo",
        receiveTime: { sec: 0, nsec: 0 },
        message: image,
        schemaName: "foxglove.CompressedImage",
        sizeInBytes: 0,
      },
    ]);

    // There's no synchronization, so we return the same state
    expect(newState).toEqual<Partial<ImagePanelState>>({
      imageTopic: "/foo",
      annotationTopics: state.annotationTopics,
      tree: state.tree,
      image: undefined,
    });

    expect(newState.tree?.minKey()).toEqual({ sec: 1, nsec: 0 });
  });

  it("stores unsynchronized image message and unsynchronized annotations", () => {
    const state = { ...emptyState(), annotationTopics: ["/annotation"] };

    {
      const image = generateImage({ sec: 1, nsec: 0 });
      const newState = synchronizedAddMessages(state, [
        {
          topic: "/foo",
          receiveTime: { sec: 0, nsec: 0 },
          message: image,
          schemaName: "foxglove.CompressedImage",
          sizeInBytes: 0,
        },
      ]);
      // There's no synchronization, so we return the same state
      expect(newState).toEqual<Partial<ImagePanelState>>({
        imageTopic: "/foo",
        tree: state.tree,
        annotationTopics: state.annotationTopics,
        image: undefined,
      });

      expect(newState.tree?.minKey()).toEqual({ sec: 1, nsec: 0 });
      expect(newState.tree?.maxKey()).toEqual({ sec: 1, nsec: 0 });
    }

    {
      const annotations = generateAnnotations({ sec: 2, nsec: 0 });
      const newState = synchronizedAddMessages(state, [
        {
          topic: "/annotation",
          receiveTime: { sec: 0, nsec: 0 },
          message: annotations,
          schemaName: "foxglove.ImageAnnotations",
          sizeInBytes: 0,
        },
      ]);
      // There's no synchronization, so we return the same state
      expect(newState).toEqual(state);

      expect(newState.tree?.minKey()).toEqual({ sec: 1, nsec: 0 });
      expect(newState.tree?.maxKey()).toEqual({ sec: 2, nsec: 0 });
    }
  });

  it("produces results when getting synchronized messages and removes old messages", () => {
    const state = { ...emptyState(), annotationTopics: ["/annotation"] };

    {
      const image = generateImage({ sec: 1, nsec: 0 });
      const newState = synchronizedAddMessages(state, [
        {
          topic: "/foo",
          receiveTime: { sec: 0, nsec: 0 },
          message: image,
          schemaName: "foxglove.CompressedImage",
          sizeInBytes: 0,
        },
      ]);
      // There's no synchronization, so we return the same state
      expect(newState).toEqual(state);
    }

    {
      const annotations = generateAnnotations({ sec: 2, nsec: 0 });
      const newState = synchronizedAddMessages(state, [
        {
          topic: "/annotation",
          receiveTime: { sec: 0, nsec: 0 },
          message: annotations,
          schemaName: "foxglove.ImageAnnotations",
          sizeInBytes: 0,
        },
      ]);
      // There's no synchronization, so we return the same state
      expect(newState).toEqual(state);
    }

    {
      const image = generateImage({ sec: 2, nsec: 0 });
      const newState = synchronizedAddMessages(state, [
        {
          topic: "/foo",
          receiveTime: { sec: 0, nsec: 0 },
          message: image,
          schemaName: "foxglove.CompressedImage",
          sizeInBytes: 0,
        },
      ]);

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

      expect(state.tree.minKey()).toEqual({ sec: 2, nsec: 0 });
      expect(state.tree.maxKey()).toEqual({ sec: 2, nsec: 0 });
    }
  });

  it("keeps messages newer than the synchronized messages", () => {
    const state = { ...emptyState(), annotationTopics: ["/annotation"] };

    {
      const image1 = generateImage({ sec: 1, nsec: 0 });
      const annotations1 = generateAnnotations({ sec: 1, nsec: 0 });
      const annotations2 = generateAnnotations({ sec: 2, nsec: 0 });
      const newState = synchronizedAddMessages(state, [
        {
          topic: "/foo",
          receiveTime: { sec: 0, nsec: 0 },
          message: image1,
          schemaName: "foxglove.CompressedImage",
          sizeInBytes: 0,
        },
        {
          topic: "/annotation",
          receiveTime: { sec: 0, nsec: 0 },
          message: annotations1,
          schemaName: "foxglove.ImageAnnotations",
          sizeInBytes: 0,
        },
        {
          topic: "/annotation",
          receiveTime: { sec: 0, nsec: 0 },
          message: annotations2,
          schemaName: "foxglove.ImageAnnotations",
          sizeInBytes: 0,
        },
      ]);

      // Synchronized image and annotations are present
      expect(newState.image).toEqual({
        data: new Uint8Array(),
        format: "format",
        stamp: { sec: 1, nsec: 0 },
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
                stamp: { sec: 1, nsec: 0 },
                thickness: 1,
                type: "circle",
              },
            ],
          }),
        ),
      );
    }

    // Newer message from the same batch is stored in the tree
    expect(state.tree.minKey()).toEqual({ sec: 1, nsec: 0 });
    expect(state.tree.maxKey()).toEqual({ sec: 2, nsec: 0 });

    // When the last message at time 2 is received, synchronized set updates
    {
      const image2 = generateImage({ sec: 2, nsec: 0 });
      const newState = synchronizedAddMessages(state, [
        {
          topic: "/foo",
          receiveTime: { sec: 0, nsec: 0 },
          message: image2,
          schemaName: "foxglove.CompressedImage",
          sizeInBytes: 0,
        },
      ]);

      expect(newState.image).toEqual({
        data: new Uint8Array(),
        format: "format",
        stamp: { nsec: 0, sec: 2 },
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

      // Older synchronized set is removed from the tree
      expect(state.tree.minKey()).toEqual({ sec: 2, nsec: 0 });
      expect(state.tree.maxKey()).toEqual({ sec: 2, nsec: 0 });
    }
  });
});
