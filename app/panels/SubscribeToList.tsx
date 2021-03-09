// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import * as React from "react";

import * as PanelAPI from "@foxglove-studio/app/PanelAPI";
import Flex from "@foxglove-studio/app/components/Flex";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import { SaveConfig } from "@foxglove-studio/app/types/panels";

// Little dummy panel that just subscribes to a bunch of topics. Doesn't actually
// do anything with them.

type Config = { topics: string };
type Props = { config: Config; saveConfig: SaveConfig<Config> };

function SubscribeToList({ config, saveConfig }: Props): React.ReactNode {
  const topics = config.topics.split(/\s*(?:\n|,|\s)\s*/);
  const messagesSeen = PanelAPI.useMessageReducer<number>({
    topics,
    restore: React.useCallback(() => 0, []),
    addMessage: React.useCallback((seenBefore) => seenBefore + 1, []),
  });
  return (
    <Flex col>
      <PanelToolbar floating />
      <textarea
        style={{ flexGrow: 1, border: "none" }}
        placeholder="add /some/topics/here separated by newlines or commas or whitespace"
        value={config.topics}
        onChange={React.useCallback((event) => saveConfig({ topics: event.target.value }), [
          saveConfig,
        ])}
      />
      <div style={{ position: "absolute", bottom: 8, right: 12 }}>
        messages seen: {messagesSeen}
      </div>
    </Flex>
  );
}

SubscribeToList.panelType = "SubscribeToList";
SubscribeToList.defaultConfig = { topics: "" };

export default Panel<Config>(SubscribeToList as any);
