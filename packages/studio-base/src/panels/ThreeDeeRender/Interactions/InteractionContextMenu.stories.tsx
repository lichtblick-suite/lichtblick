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

import { Box } from "@mui/material";

import { InteractionContextMenu } from "./InteractionContextMenu";

const selectedObject = {
  id: "obj-1",
  header: { frame_id: "some_frame", stamp: { sec: 0, nsec: 0 } },
  action: 0,
  ns: "",
  type: 0,
  scale: { x: 2, y: 2, z: 4 },
  color: { r: 1, g: 0.1, b: 0, a: 0.7 },
  pose: {
    position: { x: -1, y: 1, z: -5 },
    orientation: { x: 0, y: 0, z: 0, w: 1 },
  },
};

const sharedProps = {
  selectObject: () => {},
  clickedObjects: [
    {
      object: { ...selectedObject, interactionData: { topic: "/foo/bar" } },
      instanceIndex: undefined,
    },
    {
      object: { ...selectedObject, interactionData: { topic: "/foo1/bar" }, id: undefined },
      instanceIndex: undefined,
    },
    { object: { ...selectedObject, interactionData: { topic: "/abc/xyz" } }, instanceIndex: 10 },
    {
      object: {
        ...selectedObject,
        id: undefined,
        interactionData: { topic: "/some_topic_name/nested_name/with_very_very_very_longer_name/" },
      },
      instanceIndex: 10,
    },
    {
      object: {
        ...selectedObject,
        interactionData: { topic: "/some_topic/with_slightly_longer_names" },
      },
      instanceIndex: 10,
    },
  ],
  clickedPosition: { clientX: 100, clientY: 200 },
};

export default {
  title: "panels/ThreeDeeRender/Interactions/InteractionContextMenu",
  component: InteractionContextMenu,
};

export function Light(): JSX.Element {
  return (
    <Box height="100vh" width="100vh" bgcolor="background.default">
      <InteractionContextMenu onClose={() => {}} {...sharedProps} />
    </Box>
  );
}

Light.parameters = { colorScheme: "light" };

export function Dark(): JSX.Element {
  return (
    <Box height="100vh" width="100vh" bgcolor="background.default">
      <InteractionContextMenu onClose={() => {}} {...sharedProps} />
    </Box>
  );
}

Dark.parameters = { colorScheme: "dark" };
