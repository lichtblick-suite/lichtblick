// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { action } from "@storybook/addon-actions";
import { Story } from "@storybook/react";

import UrdfSettingsEditor from "./UrdfSettingsEditor";

export default {
  title: "panels/ThreeDimensionalViz/TopicSettingsEditor/UrdfSettingsEditor",
  component: UrdfSettingsEditor,
};

export const Default: Story = () => {
  return (
    <UrdfSettingsEditor
      message={undefined}
      settings={{}}
      onSettingsChange={action("onSettingsChange")}
      onFieldChange={action("onFieldChange")}
    />
  );
};
