// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReactElement } from "react";

import PoseSettingsEditor from "@foxglove/studio-base/panels/ThreeDimensionalViz/TopicSettingsEditor/PoseSettingsEditor";

export default {
  title: "panels/ThreeDimensionalViz/TopicSettingsEditor/PoseSettingsEditor",
  component: PoseSettingsEditor,
};

export function PoseSettingsEditorView(): ReactElement {
  const message = {
    header: {
      frame_id: "frame",
      stamp: { sec: 0, nsec: 0 },
      seq: 1,
    },
    pose: {
      position: { x: 0, y: 0, z: 0 },
      orientation: { x: 0, y: 0, z: 0, w: 0 },
    },
  };

  return (
    <PoseSettingsEditor
      message={message}
      onFieldChange={() => undefined}
      onSettingsChange={() => undefined}
      settings={{}}
    />
  );
}
