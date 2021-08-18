// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { action } from "@storybook/addon-actions";

import Settings from "./Settings";
import { Config } from "./types";

export default {
  title: "panels/Teleop/Settings",
  component: Settings,
};

export const Basic = (): JSX.Element => {
  const config: Config = {
    topic: "/topic",
    publishRate: 1,
    upButton: { field: "linear-x", value: 1 },
    downButton: { field: "linear-x", value: -1 },
    leftButton: { field: "angular-z", value: 1 },
    rightButton: { field: "angular-z", value: -1 },
  };
  return (
    <div>
      <Settings topics={["/foo"]} onConfigChange={action("onConfigChange")} config={config} />
    </div>
  );
};
