// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Stack } from "@mui/material";
import { storiesOf } from "@storybook/react";

import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";
import { PointCloud2 } from "@foxglove/studio-base/types/Messages";

import Interactions, { OBJECT_TAB_TYPE } from "./Interactions";

const markerObject = {
  id: "12345",
  header: { frame_id: "some_frame", stamp: { sec: 0, nsec: 0 } },
  action: 0,
  ns: "",
  text: "hello\nthere",
  type: 0,
  scale: {
    x: 2,
    y: 2,
    z: 4,
  },
  color: {
    r: 1,
    g: 0.1,
    b: 0,
    a: 0.7,
  },
  pose: {
    position: {
      x: -1,
      y: 1,
      z: -5,
    },
    orientation: {
      x: 0,
      y: 0,
      z: 0,
      w: 1,
    },
  },
};

// ts-prune-ignore-next
export const POINT_CLOUD_MESSAGE: PointCloud2 = {
  fields: [
    {
      name: "x",
      offset: 0,
      datatype: 7,
      count: 1,
    },
    {
      name: "y",
      offset: 4,
      datatype: 7,
      count: 1,
    },
    {
      name: "z",
      offset: 8,
      datatype: 7,
      count: 1,
    },
    {
      name: "rgb",
      offset: 16,
      datatype: 7,
      count: 1,
    },
  ],
  type: 102,
  pose: {
    position: { x: 0, y: 0, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 0 },
  },
  header: {
    seq: 0,
    frame_id: "root_frame_id",
    stamp: {
      sec: 10,
      nsec: 10,
    },
  },
  height: 1,
  is_bigendian: false,
  is_dense: 1,
  point_step: 32,
  row_step: 32,
  width: 2,
  data: new Uint8Array([
    // point 1
    // x
    125, 236, 11, 197,
    // y
    118, 102, 48, 196,
    // z
    50, 194, 23, 192,
    // ?
    0, 0, 128, 63,
    // rgb (abgr ordering)
    10, 255, 230, 127,
    // ?
    254, 127, 0, 0, 16, 142, 140, 0, 161, 254, 127, 0,
    // point 2
    // x
    125, 236, 11, 197,
    // y
    118, 102, 48, 196,
    // z
    50, 194, 23, 192,
    // ?
    0, 0, 128, 63,
    // rgb (abgr ordering)
    10, 255, 255, 127,
    // ?
    254, 127, 0, 0, 16, 142, 140, 0, 161, 254, 127, 0,
    // point 3
    // x
    118, 102, 48, 196,
    // y
    125, 236, 11, 197,
    // z
    50, 194, 23, 192,
    // ?
    0, 0, 128, 63,
    // rgb (abgr ordering)
    10, 127, 255, 127,
    // ?
    254, 127, 0, 0, 16, 142, 140, 0, 161, 254, 127, 8,
  ]),
};

// ts-prune-ignore-next
export const POINT_CLOUD_WITH_ADDITIONAL_FIELDS: PointCloud2 = {
  fields: [
    {
      name: "x",
      offset: 0,
      datatype: 7,
      count: 1,
    },
    {
      name: "y",
      offset: 4,
      datatype: 7,
      count: 1,
    },
    {
      name: "z",
      offset: 8,
      datatype: 7,
      count: 1,
    },
    {
      name: "foo",
      offset: 12,
      datatype: 2,
      count: 1,
    },
    {
      name: "bar",
      offset: 13,
      datatype: 4,
      count: 1,
    },
    {
      name: "baz",
      offset: 15,
      datatype: 5,
      count: 1,
    },
    {
      name: "foo16_some_really_really_long_name",
      offset: 19,
      datatype: 3,
      count: 1,
    },
  ],
  type: 102,
  pose: {
    position: { x: 0, y: 0, z: 0 },
    orientation: { x: 0, y: 0, z: 0, w: 0 },
  },
  header: {
    seq: 0,
    frame_id: "root_frame_id",
    stamp: {
      sec: 10,
      nsec: 10,
    },
  },
  height: 1,
  is_bigendian: false,
  is_dense: 1,
  point_step: 21,
  row_step: 21,
  width: 2,
  data: new Uint8Array([
    0, //   1, start of point 1
    0, //   2
    0, //   3
    0, //   4, x: float32 = 0
    0, //   5
    0, //   6
    128, // 7
    63, //  8, y: float32 = 1
    0, //   9
    0, //   10
    0, //   11
    64, //  12, z: float32 =  2
    7, //   13, foo: uint8 = 7
    6, //   14
    0, //   15, bar: uint16 = 6
    5, //   16
    0, //   17
    0, //   18
    0, //   19, baz: int32 = 5
    9, //   20
    1, //   21, foo16: int16 = 265
    // ---------- another row
    0, //   22, start of point 2
    0, //   23
    0, //   24
    0, //   25 x: float32 = 0
    0, //   26
    0, //   27
    128, // 28
    63, //  29 y: float32 = 1
    0, //   30
    0, //   31
    0, //   32
    64, //  33, z: float32 =  2
    9, //   34, foo: uint8 = 9
    8, //   35
    0, //   36, bar: uint16 = 8
    7, //   37
    0, //   38
    0, //   39
    0, //   40, baz: int32 = 7
    2, //   41
    0, //   42, foo16: int16 = 2
  ]),
};

const interactiveMarkerObject = {
  ...markerObject,
  interactionData: { topic: "/foo/bar", originalMessage: markerObject },
};
const selectedObject = { object: interactiveMarkerObject, instanceIndex: undefined };

const sharedProps = {
  selectedObject,
  interactionsTabType: OBJECT_TAB_TYPE,
  setInteractionsTabType: () => {
    // no-op
  },
};

function PanelSetupWithData({
  children,
  title,
  onMount,
}: {
  children: React.ReactNode;
  title: React.ReactNode;
  onMount?: (el: HTMLDivElement) => void;
}) {
  return (
    <PanelSetup
      omitDragAndDrop
      style={{ width: "auto", height: "auto", display: "inline-flex" }}
      fixture={{
        topics: [],
        datatypes: new Map(),
        frame: {},
        globalVariables: {
          id: 100,
          scaleY: 2.4,
          fooScaleX: 3,
        },
      }}
    >
      <div
        style={{ margin: 16 }}
        ref={(el) => {
          if (el && onMount) {
            onMount(el);
          }
        }}
      >
        <p>{title}</p>
        <Stack direction="row" flex="auto">
          {children}
        </Stack>
      </div>
    </PanelSetup>
  );
}

function DefaultStory() {
  return (
    <Stack direction="row" flexWrap="wrap" height="100%" bgcolor="background.paper">
      <PanelSetupWithData title="Default without clicked object">
        <Interactions
          {...(sharedProps as any)}
          selectedObject={undefined}
          interactionsTabType={OBJECT_TAB_TYPE}
        />
      </PanelSetupWithData>
      <PanelSetupWithData title="With interactionData">
        <Interactions {...(sharedProps as any)} />
      </PanelSetupWithData>
    </Stack>
  );
}

storiesOf("panels/ThreeDeeRender/Interactions/Interaction", module)
  .addParameters({
    chromatic: { viewport: { width: 1001, height: 1101 } },
  })
  .add("default", DefaultStory, { colorScheme: "dark" })
  .add("default light", DefaultStory, { colorScheme: "light" })
  .add("PointCloud", () => {
    const cloud1 = { ...selectedObject.object, ...POINT_CLOUD_MESSAGE };
    const cloud2 = {
      ...selectedObject.object,
      ...POINT_CLOUD_WITH_ADDITIONAL_FIELDS,
    };

    return (
      <Stack direction="row" flexWrap="wrap" height="100%" bgcolor="background.paper">
        <PanelSetupWithData title="default with point color">
          <Interactions
            {...(sharedProps as any)}
            selectedObject={{
              instanceIndex: 0,
              object: {
                ...cloud1,
                type: 102,
                interactionData: { topic: "/foo/bar", originalMessage: POINT_CLOUD_MESSAGE },
              },
            }}
          />
        </PanelSetupWithData>
        <PanelSetupWithData title="with additional fields">
          <Interactions
            {...(sharedProps as any)}
            selectedObject={{
              instanceIndex: 0,
              object: {
                ...cloud2,
                type: 102,
                interactionData: {
                  topic: "/foo/bar",
                  originalMessage: POINT_CLOUD_WITH_ADDITIONAL_FIELDS,
                },
              },
            }}
          />
        </PanelSetupWithData>
      </Stack>
    );
  });
