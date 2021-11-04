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
import { useTheme } from "@fluentui/react";
import { useState, useRef, useEffect, ReactElement } from "react";
import styled from "styled-components";

import Button from "@foxglove/studio-base/components/Button";
import Flex from "@foxglove/studio-base/components/Flex";
import { useUserNodeState } from "@foxglove/studio-base/context/UserNodeStateContext";
import DiagnosticsSection from "@foxglove/studio-base/panels/NodePlayground/BottomBar/DiagnosticsSection";
import LogsSection from "@foxglove/studio-base/panels/NodePlayground/BottomBar/LogsSection";
import { Diagnostic, UserNodeLog } from "@foxglove/studio-base/players/UserNodePlayer/types";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

const SHeaderItem = styled.div`
  cursor: pointer;
  padding: 4px;
  text-transform: uppercase;
`;

type Props = {
  nodeId?: string;
  isSaved: boolean;
  save: () => void;
  diagnostics: readonly Diagnostic[];
  logs: readonly UserNodeLog[];
};

type HeaderItemProps = {
  text: string;
  isOpen: boolean;
  numItems: number;
};

function HeaderItem({ isOpen, numItems, text }: HeaderItemProps) {
  const theme = useTheme();
  return (
    <SHeaderItem
      style={{
        color: numItems > 0 ? theme.semanticColors.errorBackground : "inherit",
        borderBottom: isOpen ? `1px solid ${colors.DARK6}` : "none",
        paddingBottom: isOpen ? 2 : 0,
      }}
    >
      {text} {numItems > 0 ? numItems : ""}
    </SHeaderItem>
  );
}

const BottomBar = ({ nodeId, isSaved, save, diagnostics, logs }: Props): ReactElement => {
  const [bottomBarDisplay, setBottomBarDisplay] = useState("closed");
  const [autoScroll, setAutoScroll] = useState(true);

  const { clearUserNodeLogs } = useUserNodeState();
  const scrollContainer = useRef<HTMLDivElement>(ReactNull);

  useEffect(() => {
    if (autoScroll) {
      if (scrollContainer.current) {
        scrollContainer.current.scrollTop = scrollContainer.current.scrollHeight;
      }
    }
  }, [autoScroll, logs]);

  return (
    <Flex col style={{ backgroundColor: colors.DARK1, position: "relative" }}>
      <Flex
        row
        start
        style={{
          padding: 5,
          bottom: 0,
        }}
      >
        <Flex
          center
          style={{ flexGrow: 0, color: colors.DARK9 }}
          dataTest="np-errors"
          onClick={() => {
            if (bottomBarDisplay !== "diagnostics") {
              setBottomBarDisplay("diagnostics");
            } else {
              setBottomBarDisplay("closed");
            }
          }}
        >
          <HeaderItem
            text="Problems"
            numItems={diagnostics.length}
            isOpen={bottomBarDisplay === "diagnostics"}
          />
        </Flex>
        <Flex
          center
          style={{ flexGrow: 0, color: colors.DARK9 }}
          dataTest="np-logs"
          onClick={() => {
            if (bottomBarDisplay !== "logs") {
              setBottomBarDisplay("logs");
            } else {
              setBottomBarDisplay("closed");
            }
          }}
        >
          <HeaderItem text="Logs" numItems={logs.length} isOpen={bottomBarDisplay === "logs"} />
        </Flex>
        <Button
          style={{ padding: "2px 4px" }}
          primary={!isSaved}
          disabled={isSaved}
          tooltip={"ctrl/cmd + s"}
          onClick={() => {
            if (nodeId != undefined) {
              save();
              clearUserNodeLogs(nodeId);
            }
          }}
        >
          {isSaved ? "saved" : "save"}
        </Button>
      </Flex>
      <div
        ref={scrollContainer}
        onScroll={({ currentTarget }) => {
          const scrolledUp =
            currentTarget.scrollHeight - currentTarget.scrollTop > currentTarget.clientHeight;
          if (scrolledUp && autoScroll) {
            setAutoScroll(false);
          } else if (!scrolledUp && !autoScroll) {
            setAutoScroll(true);
          }
        }}
        style={{
          overflowY: bottomBarDisplay !== "closed" ? "scroll" : "auto",
          height: bottomBarDisplay !== "closed" ? 150 : 0,
          color: colors.DARK9,
        }}
      >
        {bottomBarDisplay === "diagnostics" && <DiagnosticsSection diagnostics={diagnostics} />}
        {bottomBarDisplay === "logs" && (
          <LogsSection nodeId={nodeId} logs={logs} clearLogs={clearUserNodeLogs} />
        )}
      </div>
    </Flex>
  );
};

export default BottomBar;
