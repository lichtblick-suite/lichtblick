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
import { Box, Stack } from "@mui/material";
import { useState, useRef, useEffect, ReactElement } from "react";
import styled from "styled-components";

import Button from "@foxglove/studio-base/components/Button";
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
  const theme = useTheme();

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
    <Stack flex="auto" bgcolor={theme.palette.neutralLighterAlt} position="relative">
      <Stack direction="row" flex="auto" alignItems="flex-start" padding={0.625} bottom={0}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          color={colors.DARK9}
          data-test="np-errors"
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
        </Stack>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="center"
          color={colors.DARK9}
          data-test="np-logs"
          onClick={() => {
            if (bottomBarDisplay !== "logs") {
              setBottomBarDisplay("logs");
            } else {
              setBottomBarDisplay("closed");
            }
          }}
        >
          <HeaderItem text="Logs" numItems={logs.length} isOpen={bottomBarDisplay === "logs"} />
        </Stack>
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
      </Stack>
      <Box
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
      </Box>
    </Stack>
  );
};

export default BottomBar;
