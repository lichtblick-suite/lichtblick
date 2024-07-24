// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Script } from "./script";

type Config = {
  selectedNodeId?: string;
  // Used only for storybook screenshot testing.
  editorForStorybook?: React.ReactNode;
  // Used only for storybook screenshot testing.
  additionalBackStackItems?: Script[];
  autoFormatOnSave?: boolean;
};

export default Config;
