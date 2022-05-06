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

import { useTheme, Link, Spinner, SpinnerSize } from "@fluentui/react";
import ArrowLeftIcon from "@mdi/svg/svg/arrow-left.svg";
import PlusIcon from "@mdi/svg/svg/plus.svg";
import { Box, Input, Stack } from "@mui/material";
import { Suspense, useCallback, useEffect, useState } from "react";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";

import Button from "@foxglove/studio-base/components/Button";
import Icon from "@foxglove/studio-base/components/Icon";
import Panel from "@foxglove/studio-base/components/Panel";
import { usePanelContext } from "@foxglove/studio-base/components/PanelContext";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import {
  SettingsTreeAction,
  SettingsTreeNode,
} from "@foxglove/studio-base/components/SettingsTreeEditor/types";
import TextContent from "@foxglove/studio-base/components/TextContent";
import {
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useUserNodeState } from "@foxglove/studio-base/context/UserNodeStateContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";
import BottomBar from "@foxglove/studio-base/panels/NodePlayground/BottomBar";
import Sidebar from "@foxglove/studio-base/panels/NodePlayground/Sidebar";
import Playground from "@foxglove/studio-base/panels/NodePlayground/playground-icon.svg";
import { HelpInfoStore, useHelpInfo } from "@foxglove/studio-base/providers/HelpInfoProvider";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelSettingsEditorContextProvider";
import { UserNodes } from "@foxglove/studio-base/types/panels";
import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

import Config from "./Config";
import helpContent from "./index.help.md";
import { Script } from "./script";

const Editor = React.lazy(
  async () => await import("@foxglove/studio-base/panels/NodePlayground/Editor"),
);

const skeletonBody = `\
// The ./types module provides helper types for your Input events and messages.
import { Input, Message } from "./types";

// Your node can output well-known message types, any of your custom message types, or
// complete custom message types.
//
// Use \`Message\` to access your data source types or well-known types:
// type Twist = Message<"geometry_msgs/Twist">;
//
// Conventionally, it's common to make a _type alias_ for your node's output type
// and use that type name as the return type for your node function.
// Here we've called the type \`Output\` but you can pick any type name.
type Output = {
  hello: string;
};

// These are the topics your node "subscribes" to. Studio will invoke your node function
// when any message is received on one of these topics.
export const inputs = ["/input/topic"];

// Any output your node produces is "published" to this topic. Published messages are only visible within Studio, not to your original data source.
export const output = "/studio_node/output_topic";

// This function is called with messages from your input topics.
// The first argument is an event with the topic, receive time, and message.
// Use the \`Input<...>\` helper to get the correct event type for your input topic messages.
export default function node(event: Input<"/input/topic">): Output {
  return {
    hello: "world!",
  };
};`;

type Props = {
  config: Config;
  saveConfig: (config: Partial<Config>) => void;
};

const UnsavedDot = styled.div`
  display: ${({ isSaved }: { isSaved: boolean }) => (isSaved ? "none" : "initial")};
  width: 6px;
  height: 6px;
  border-radius: 50%;
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background-color: ${colors.DARK9};
`;

const SWelcomeScreen = styled.div`
  display: flex;
  text-align: center;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 25%;
  height: 100%;
  > * {
    margin: 4px 0;
  }
`;

export type Explorer = undefined | "nodes" | "utils" | "templates";

function buildSettingsStree(config: Config): SettingsTreeNode {
  return {
    fields: {
      autoFormatOnSave: {
        input: "boolean",
        label: "Auto-format on save",
        value: config.autoFormatOnSave,
      },
    },
  };
}

const selectSetHelpInfo = (store: HelpInfoStore) => store.setHelpInfo;

const WelcomeScreen = ({ addNewNode }: { addNewNode: (code?: string) => void }) => {
  const setHelpInfo = useHelpInfo(selectSetHelpInfo);
  const { openHelp } = useWorkspace();
  return (
    <SWelcomeScreen>
      <Playground />
      <TextContent>
        Welcome to Node Playground! Get started by reading the{" "}
        <Link
          href=""
          onClick={(e) => {
            e.preventDefault();
            setHelpInfo({ title: "NodePlayground", content: helpContent });
            openHelp();
          }}
        >
          docs
        </Link>
        , or just create a new node.
      </TextContent>
      <Button style={{ marginTop: "8px" }} onClick={() => addNewNode()}>
        <Icon size="medium">
          <PlusIcon />
        </Icon>{" "}
        New node
      </Button>
    </SWelcomeScreen>
  );
};

const EMPTY_USER_NODES: UserNodes = Object.freeze({});

const userNodeSelector = (state: LayoutState) =>
  state.selectedLayout?.data?.userNodes ?? EMPTY_USER_NODES;

function NodePlayground(props: Props) {
  const { config, saveConfig } = props;
  const { autoFormatOnSave = false, selectedNodeId, editorForStorybook } = config;
  const { id: panelId } = usePanelContext();
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();

  const theme = useTheme();
  const [explorer, updateExplorer] = React.useState<Explorer>(undefined);

  const userNodes = useCurrentLayoutSelector(userNodeSelector);
  const {
    state: { nodeStates: userNodeDiagnostics, rosLib, typesLib },
  } = useUserNodeState();

  const { setUserNodes } = useCurrentLayoutActions();

  const selectedNodeDiagnostics =
    (selectedNodeId != undefined ? userNodeDiagnostics[selectedNodeId]?.diagnostics : undefined) ??
    [];
  const selectedNode = selectedNodeId != undefined ? userNodes[selectedNodeId] : undefined;
  const [scriptBackStack, setScriptBackStack] = React.useState<Script[]>([]);
  // Holds the currently active script
  const currentScript =
    scriptBackStack.length > 0 ? scriptBackStack[scriptBackStack.length - 1] : undefined;
  const isCurrentScriptSelectedNode =
    !!selectedNode && !!currentScript && currentScript.filePath === selectedNode.name;
  const isNodeSaved =
    !isCurrentScriptSelectedNode || currentScript.code === selectedNode.sourceCode;
  const selectedNodeLogs =
    (selectedNodeId != undefined ? userNodeDiagnostics[selectedNodeId]?.logs : undefined) ?? [];

  // The current node name is editable via the "tab". The tab uses a controlled input. React requires
  // that we render the new text on the next render for the controlled input to retain the cursor position.
  // For this we use setInputTitle within the onChange event of the input control.
  //
  // We also update the input title when the script changes using a layout effect below.
  const [inputTitle, setInputTitle] = useState<string>(() => {
    return currentScript
      ? currentScript.filePath + (currentScript.readOnly ? " (READONLY)" : "")
      : "node name";
  });

  const inputStyle = {
    backgroundColor: theme.semanticColors.bodyBackground,
    width: `${Math.max(inputTitle.length + 4, 10)}ch`, // Width based on character count of title + padding
  };

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      const { input, value, path } = action.payload;
      if (input === "boolean" && path[0] === "autoFormatOnSave") {
        saveConfig({ ...config, autoFormatOnSave: value });
      }
    },
    [config, saveConfig],
  );

  useEffect(() => {
    updatePanelSettingsTree(panelId, {
      actionHandler,
      settings: buildSettingsStree(config),
    });
  }, [actionHandler, config, panelId, updatePanelSettingsTree]);

  React.useLayoutEffect(() => {
    if (selectedNode) {
      const testItems = props.config.additionalBackStackItems ?? [];
      setScriptBackStack([
        { filePath: selectedNode.name, code: selectedNode.sourceCode, readOnly: false },
        ...testItems,
      ]);
    }
  }, [props.config.additionalBackStackItems, selectedNode]);

  React.useLayoutEffect(() => {
    setInputTitle(() => {
      return currentScript
        ? currentScript.filePath + (currentScript.readOnly ? " (READONLY)" : "")
        : "node name";
    });
  }, [currentScript]);

  const addNewNode = React.useCallback(
    (code?: string) => {
      const newNodeId = uuidv4();
      const sourceCode = code ?? skeletonBody;
      setUserNodes({
        [newNodeId]: {
          sourceCode,
          name: `${newNodeId.split("-")[0]}`,
        },
      });
      saveConfig({ selectedNodeId: newNodeId });
    },
    [saveConfig, setUserNodes],
  );

  const saveNode = React.useCallback(
    (script: string | undefined) => {
      if (selectedNodeId == undefined || script == undefined || script === "" || !selectedNode) {
        return;
      }
      setUserNodes({ [selectedNodeId]: { ...selectedNode, sourceCode: script } });
    },
    [selectedNode, selectedNodeId, setUserNodes],
  );

  const setScriptOverride = React.useCallback(
    (script: Script, maxDepth?: number) => {
      if (maxDepth != undefined && maxDepth > 0 && scriptBackStack.length >= maxDepth) {
        setScriptBackStack([...scriptBackStack.slice(0, maxDepth - 1), script]);
      } else {
        setScriptBackStack([...scriptBackStack, script]);
      }
    },
    [scriptBackStack],
  );

  const goBack = React.useCallback(() => {
    setScriptBackStack(scriptBackStack.slice(0, scriptBackStack.length - 1));
  }, [scriptBackStack]);

  const setScriptCode = React.useCallback(
    (code: string) => {
      // update code at top of backstack
      const backStack = [...scriptBackStack];
      if (backStack.length > 0) {
        const script = backStack.pop();
        if (script && !script.readOnly) {
          setScriptBackStack([...backStack, { ...script, code }]);
        }
      }
    },
    [scriptBackStack],
  );

  return (
    <Stack height="100%">
      <PanelToolbar floating helpContent={helpContent} />
      <Stack direction="row" height="100%">
        <Sidebar
          explorer={explorer}
          updateExplorer={updateExplorer}
          selectNode={(nodeId) => {
            if (
              selectedNodeId != undefined &&
              selectedNode &&
              currentScript &&
              isCurrentScriptSelectedNode
            ) {
              // Save current state so that user can seamlessly go back to previous work.
              setUserNodes({
                [selectedNodeId]: { ...selectedNode, sourceCode: currentScript.code },
              });
            }
            saveConfig({ selectedNodeId: nodeId });
          }}
          deleteNode={(nodeId) => {
            setUserNodes({ ...userNodes, [nodeId]: undefined });
            saveConfig({ selectedNodeId: undefined });
          }}
          selectedNodeId={selectedNodeId}
          userNodes={userNodes}
          script={currentScript}
          setScriptOverride={setScriptOverride}
          addNewNode={addNewNode}
        />
        <Stack flexGrow={1} height="100%" overflow="hidden">
          <Stack direction="row" alignItems="center" bgcolor={theme.palette.neutralLighterAlt}>
            {scriptBackStack.length > 1 && (
              <Icon
                size="large"
                tooltip="Go back"
                dataTest="go-back"
                style={{ color: colors.DARK9 }}
                onClick={goBack}
              >
                <ArrowLeftIcon />
              </Icon>
            )}
            {selectedNodeId != undefined && selectedNode && (
              <div style={{ position: "relative" }}>
                <Input
                  size="small"
                  disableUnderline
                  placeholder="node name"
                  value={inputTitle}
                  disabled={!currentScript || currentScript.readOnly}
                  onChange={(ev) => {
                    const newNodeName = ev.target.value;
                    setInputTitle(newNodeName);
                    setUserNodes({
                      ...userNodes,
                      [selectedNodeId]: { ...selectedNode, name: newNodeName },
                    });
                  }}
                  inputProps={{ spellCheck: false, style: inputStyle }}
                />
                <UnsavedDot isSaved={isNodeSaved} />
              </div>
            )}
            <Icon
              size="large"
              tooltip="new node"
              dataTest="new-node"
              style={{ color: colors.DARK9, padding: "0 5px" }}
              onClick={() => addNewNode()}
            >
              <PlusIcon />
            </Icon>
          </Stack>

          <Stack flexGrow={1} overflow="hidden ">
            {selectedNodeId == undefined && <WelcomeScreen addNewNode={addNewNode} />}
            <Box
              style={{
                flexGrow: 1,
                width: "100%",
                overflow: "hidden",
                display: selectedNodeId != undefined ? "initial" : "none",
                /* Ensures the monaco-editor starts loading before the user opens it */
              }}
            >
              <Suspense
                fallback={
                  <Stack
                    direction="row"
                    flex="auto"
                    alignItems="center"
                    justifyContent="center"
                    width="100%"
                    height="100%"
                  >
                    <Spinner size={SpinnerSize.large} />
                  </Stack>
                }
              >
                {editorForStorybook ?? (
                  <Editor
                    autoFormatOnSave={autoFormatOnSave}
                    script={currentScript}
                    setScriptCode={setScriptCode}
                    setScriptOverride={setScriptOverride}
                    rosLib={rosLib}
                    typesLib={typesLib}
                    save={saveNode}
                  />
                )}
              </Suspense>
            </Box>
            <Stack>
              <BottomBar
                nodeId={selectedNodeId}
                isSaved={isNodeSaved}
                save={() => saveNode(currentScript?.code)}
                diagnostics={selectedNodeDiagnostics}
                logs={selectedNodeLogs}
              />
            </Stack>
          </Stack>
        </Stack>
      </Stack>
    </Stack>
  );
}

const defaultConfig: Config = {
  selectedNodeId: undefined,
  autoFormatOnSave: true,
};
export default Panel(
  Object.assign(NodePlayground, {
    panelType: "NodePlayground",
    defaultConfig,
  }),
);
