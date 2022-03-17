// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ReactElement } from "react";

import OccupancyGridSettingsEditor from "./OccupancyGridSettingsEditor";

export default {
  title: "panels/ThreeDimensionalViz/TopicSettingsEditor/OccupancyGridSettingsEditor",
  component: OccupancyGridSettingsEditor,
};

export function Default(): ReactElement {
  return (
    <OccupancyGridSettingsEditor
      onFieldChange={() => undefined}
      onSettingsChange={() => undefined}
      settings={{}}
    />
  );
}
