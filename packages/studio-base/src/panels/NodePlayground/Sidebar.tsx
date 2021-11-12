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

import ArrowLeftBoldIcon from "@mdi/svg/svg/arrow-left-bold.svg";
import DeleteIcon from "@mdi/svg/svg/delete.svg";
import FileMultipleIcon from "@mdi/svg/svg/file-multiple.svg";
import HelpCircleIcon from "@mdi/svg/svg/help-circle.svg";
import * as monacoApi from "monaco-editor/esm/vs/editor/editor.api";
import styled from "styled-components";

import Flex from "@foxglove/studio-base/components/Flex";
import Icon from "@foxglove/studio-base/components/Icon";
import { Explorer } from "@foxglove/studio-base/panels/NodePlayground";
import TemplateIcon from "@foxglove/studio-base/panels/NodePlayground/assets/file-document-edit.svg";
import HammerWrenchIcon from "@foxglove/studio-base/panels/NodePlayground/assets/hammer-wrench.svg";
import { Script } from "@foxglove/studio-base/panels/NodePlayground/script";
import { getNodeProjectConfig } from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/projectConfig";
import templates from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/templates";
import { UserNodes } from "@foxglove/studio-base/types/panels";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

const MenuWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 40px;
  background-color: ${colors.DARK1};
  & > * {
    margin: 10px;
  }
`;

const ExplorerWrapper = styled.div<{ useThemeColors: boolean; show: boolean }>`
  display: ${({ show }: { show: boolean }) => (show ? "initial" : "none")};
  background-color: ${({ useThemeColors, theme }) =>
    useThemeColors ? theme.palette.neutralLighterAlt : colors.GRAY2};
  max-width: 325px;
  min-width: 275px;
  overflow: auto;
`;

const ListItem = styled.li`
  padding: 5px;
  cursor: pointer;
  display: flex;
  font-size: 14px;
  justify-content: space-between;
  word-break: break-all;
  align-items: center;
  color: ${colors.LIGHT1};
  background-color: ${({ selected }: { selected: boolean }) =>
    selected ? colors.DARK9 : "transparent"};
  > span {
    opacity: 0;
  }
  &:hover {
    background-color: ${colors.DARK9};
    span {
      opacity: 1;
    }
  }
`;

const TemplateItem = styled.li`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 5px;
  cursor: pointer;
  display: flex;
  font-size: 14px;
  word-break: break-all;
  > span {
    display: block;
    margin: 3px 0;
  }
  color: ${colors.LIGHT1};
  &:hover {
    background-color: ${colors.DARK9};
  }
`;

type NodesListProps = {
  nodes: UserNodes;
  selectNode: (id: string) => void;
  deleteNode: (id: string) => void;
  collapse: () => void;
  selectedNodeId?: string;
};

const NodesList = ({ nodes, selectNode, deleteNode, collapse, selectedNodeId }: NodesListProps) => {
  return (
    <Flex col>
      <SidebarTitle title="Nodes" collapse={collapse} />
      {Object.keys(nodes).map((nodeId) => {
        return (
          <ListItem
            key={nodeId}
            selected={selectedNodeId === nodeId}
            onClick={() => selectNode(nodeId)}
          >
            {nodes[nodeId]?.name}
            <Icon onClick={() => deleteNode(nodeId)} size="medium">
              <DeleteIcon />
            </Icon>
          </ListItem>
        );
      })}
    </Flex>
  );
};

type Props = {
  selectNode: (nodeId: string) => void;
  deleteNode: (nodeId: string) => void;
  userNodes: UserNodes;
  selectedNodeId?: string;
  explorer: Explorer;
  updateExplorer: (explorer: Explorer) => void;
  setScriptOverride: (script: Script, maxDepth?: number) => void;
  script?: Script;
  addNewNode: (sourceCode?: string) => void;
};

const { utilityFiles } = getNodeProjectConfig();

const SidebarTitle = ({
  title,
  tooltip,
  collapse,
}: {
  title: string;
  tooltip?: string;
  collapse: () => void;
}) => (
  <Flex row style={{ alignItems: "center", color: colors.DARK9, padding: "5px" }}>
    <h3>{title}</h3>
    {tooltip && (
      <Icon style={{ cursor: "unset", marginLeft: "5px" }} size="xsmall" tooltip={tooltip}>
        <HelpCircleIcon />
      </Icon>
    )}
    <div style={{ display: "flex", justifyContent: "flex-end", flexGrow: 1 }}>
      <Icon onClick={collapse} size="medium" tooltip={"collapse"}>
        <ArrowLeftBoldIcon />
      </Icon>
    </div>
  </Flex>
);

const Sidebar = ({
  userNodes,
  selectNode,
  deleteNode,
  selectedNodeId,
  explorer,
  updateExplorer,
  setScriptOverride,
  script,
  addNewNode,
}: Props): React.ReactElement => {
  const nodesSelected = explorer === "nodes";
  const utilsSelected = explorer === "utils";
  const templatesSelected = explorer === "templates";

  const gotoUtils = React.useCallback(
    (filePath: string) => {
      const monacoFilePath = monacoApi.Uri.parse(`file://${filePath}`);
      const requestedModel = monacoApi.editor.getModel(monacoFilePath);
      if (!requestedModel) {
        return;
      }
      setScriptOverride(
        {
          filePath: requestedModel.uri.path,
          code: requestedModel.getValue(),
          readOnly: true,
          selection: undefined,
        },
        2,
      );
    },
    [setScriptOverride],
  );

  const explorers = React.useMemo(
    () => ({
      nodes: (
        <NodesList
          nodes={userNodes}
          selectNode={selectNode}
          deleteNode={deleteNode}
          collapse={() => updateExplorer(undefined)}
          selectedNodeId={selectedNodeId}
        />
      ),
      utils: (
        <Flex col style={{ position: "relative" }}>
          <SidebarTitle
            collapse={() => updateExplorer(undefined)}
            title="Utilities"
            tooltip={`You can import any of these modules into your node using the following syntax: 'import { .. } from "./pointClouds.ts".\n\nWant to contribute? Scroll to the bottom of the docs for details!`}
          />
          {utilityFiles.map(({ fileName, filePath }) => (
            <ListItem
              key={filePath}
              onClick={gotoUtils.bind(undefined, filePath)}
              selected={script ? filePath === script.filePath : false}
            >
              {fileName}
            </ListItem>
          ))}
        </Flex>
      ),
      templates: (
        <Flex col>
          <SidebarTitle
            title="Templates"
            tooltip={"Create nodes from these templates"}
            collapse={() => updateExplorer(undefined)}
          />
          {templates.map(({ name, description, template }, i) => (
            <TemplateItem key={`${name}-${i}`} onClick={() => addNewNode(template)}>
              <span style={{ fontWeight: "bold" }}>{name}</span>
              <span>{description}</span>
            </TemplateItem>
          ))}
        </Flex>
      ),
    }),
    [
      addNewNode,
      deleteNode,
      gotoUtils,
      script,
      selectNode,
      selectedNodeId,
      updateExplorer,
      userNodes,
    ],
  );

  return (
    <>
      <MenuWrapper>
        <Icon
          dataTest="node-explorer"
          onClick={() => updateExplorer(nodesSelected ? undefined : "nodes")}
          size="large"
          tooltip="Nodes"
          style={{ color: nodesSelected ? colors.LIGHT1 : colors.DARK9, position: "relative" }}
        >
          <FileMultipleIcon />
        </Icon>
        <Icon
          dataTest="utils-explorer"
          onClick={() => updateExplorer(utilsSelected ? undefined : "utils")}
          size="large"
          tooltip="Utilities"
          style={{ color: utilsSelected ? colors.LIGHT1 : colors.DARK9 }}
        >
          <HammerWrenchIcon />
        </Icon>
        <Icon
          dataTest="templates-explorer"
          onClick={() => updateExplorer(templatesSelected ? undefined : "templates")}
          size="large"
          tooltip="Templates"
          style={{ color: templatesSelected ? colors.LIGHT1 : colors.DARK9 }}
        >
          <TemplateIcon />
        </Icon>
      </MenuWrapper>
      <ExplorerWrapper useThemeColors={false} show={explorer != undefined}>
        {explorer != undefined && explorers[explorer]}
      </ExplorerWrapper>
    </>
  );
};

export default Sidebar;
