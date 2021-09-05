// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import styled from "styled-components";

import { useMessagesByTopic } from "@foxglove/studio-base/PanelAPI";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Flex from "@foxglove/studio-base/components/Flex";
import MessagePathInput from "@foxglove/studio-base/components/MessagePathSyntax/MessagePathInput";
import { RosPath } from "@foxglove/studio-base/components/MessagePathSyntax/constants";
import parseRosPath from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import { useCachedGetMessagePathDataItems } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import { SaveConfig } from "@foxglove/studio-base/types/panels";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import Table from "./Table";
import helpContent from "./index.help.md";

const TableContainer = styled.div`
  overflow: auto;
  display: flex;
  flex-direction: column;
  font-family: ${fonts.MONOSPACE};
`;

type Config = { topicPath: string };
type Props = { config: Config; saveConfig: SaveConfig<Config> };

function TablePanel({ config, saveConfig }: Props) {
  const { topicPath } = config;
  const onTopicPathChange = React.useCallback(
    (newTopicPath: string) => {
      saveConfig({ topicPath: newTopicPath });
    },
    [saveConfig],
  );

  const topicRosPath: RosPath | undefined = React.useMemo(
    () => parseRosPath(topicPath),
    [topicPath],
  );
  const topicName = topicRosPath?.topicName ?? "";
  const msgs = useMessagesByTopic({ topics: [topicName], historySize: 1 })[topicName];
  const cachedGetMessagePathDataItems = useCachedGetMessagePathDataItems([topicPath]);
  const msg = msgs?.[0];
  const cachedMessages = msg ? cachedGetMessagePathDataItems(topicPath, msg) ?? [] : [];
  const firstCachedMessage = cachedMessages[0];

  return (
    <Flex col clip style={{ position: "relative" }}>
      <PanelToolbar helpContent={helpContent}>
        <div style={{ width: "100%", lineHeight: "20px" }}>
          <MessagePathInput
            index={0}
            path={topicPath}
            onChange={onTopicPathChange}
            inputStyle={{ height: "100%" }}
          />
        </div>
      </PanelToolbar>
      {topicPath.length === 0 && <EmptyState>No topic selected</EmptyState>}
      {topicPath.length !== 0 && cachedMessages.length === 0 && (
        <EmptyState>Waiting for next message</EmptyState>
      )}
      {topicPath.length !== 0 && firstCachedMessage && (
        <TableContainer>
          <Table value={firstCachedMessage.value} accessorPath={""} />
        </TableContainer>
      )}
    </Flex>
  );
}

TablePanel.panelType = "Table";
TablePanel.defaultConfig = {
  topicPath: "",
};
TablePanel.supportsStrictMode = false;

export default Panel(TablePanel);
