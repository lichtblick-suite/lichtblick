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

import AddIcon from "@mui/icons-material/Add";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  Button,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  Input,
  Link,
  Typography,
  useTheme,
  styled as muiStyled,
} from "@mui/material";
import { Suspense, useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { SettingsTreeAction, SettingsTreeNodes } from "@foxglove/studio";
import EmptyState from "@foxglove/studio-base/components/EmptyState";
import Panel from "@foxglove/studio-base/components/Panel";
import PanelToolbar from "@foxglove/studio-base/components/PanelToolbar";
import Stack from "@foxglove/studio-base/components/Stack";
import {
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { useUserNodeState } from "@foxglove/studio-base/context/UserNodeStateContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";
import BottomBar from "@foxglove/studio-base/panels/NodePlayground/BottomBar";
import Sidebar from "@foxglove/studio-base/panels/NodePlayground/Sidebar";
import { HelpInfoStore, useHelpInfo } from "@foxglove/studio-base/providers/HelpInfoProvider";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelSettingsEditorContextProvider";
import { SaveConfig, UserNodes } from "@foxglove/studio-base/types/panels";

import Config from "./Config";
import helpContent from "./index.help.md";
import { Script } from "./script";

const Editor = React.lazy(
  async () => await import("@foxglove/studio-base/panels/NodePlayground/Editor"),
);

const skeletonBody = `\
// The ./types module provides helper types for your Input events and messages.
import { Input, Message } from "./types";

// Your script can output well-known message types, any of your custom message types, or
// complete custom message types.
//
// Use \`Message\` to access your data source types or well-known types:
// type Twist = Message<"geometry_msgs/Twist">;
//
// Conventionally, it's common to make a _type alias_ for your script's output type
// and use that type name as the return type for your script function.
// Here we've called the type \`Output\` but you can pick any type name.
type Output = {
  hello: string;
};

// These are the topics your script "subscribes" to. Studio will invoke your script function
// when any message is received on one of these topics.
export const inputs = ["/input/topic"];

// Any output your script produces is "published" to this topic. Published messages are only visible within Studio, not to your original data source.
export const output = "/studio_script/output_topic";

// This function is called with messages from your input topics.
// The first argument is an event with the topic, receive time, and message.
// Use the \`Input<...>\` helper to get the correct event type for your input topic messages.
export default function script(event: Input<"/input/topic">): Output {
  return {
    hello: "world!",
  };
};`;

type Props = {
  config: Config;
  saveConfig: SaveConfig<Config>;
};

const UnsavedDot = muiStyled("div", {
  shouldForwardProp: (prop) => prop !== "isSaved",
})<{
  isSaved: boolean;
}>(({ isSaved, theme }) => ({
  display: isSaved ? "none" : "initial",
  width: 6,
  height: 6,
  borderRadius: "50%",
  top: "50%",
  position: "absolute",
  right: theme.spacing(1),
  transform: "translateY(-50%)",
  backgroundColor: theme.palette.text.secondary,
}));

const StyledInput = muiStyled(Input)(({ theme }) => ({
  ".MuiInput-input": {
    padding: theme.spacing(1),
  },
}));

export type Explorer = undefined | "nodes" | "utils" | "templates";

function buildSettingsTree(config: Config): SettingsTreeNodes {
  return {
    general: {
      icon: "Settings",
      fields: {
        autoFormatOnSave: {
          input: "boolean",
          label: "Auto-format on save",
          value: config.autoFormatOnSave,
        },
      },
    },
  };
}

const selectSetHelpInfo = (store: HelpInfoStore) => store.setHelpInfo;

const WelcomeScreen = ({ addNewNode }: { addNewNode: (code?: string) => void }) => {
  const setHelpInfo = useHelpInfo(selectSetHelpInfo);
  const { openHelp } = useWorkspace();
  return (
    <EmptyState>
      <Container maxWidth="xs">
        <Stack justifyContent="center" alignItems="center" gap={1} fullHeight>
          <Typography variant="inherit" gutterBottom>
            Welcome to User Scripts!
            <br />
            Get started by reading the{" "}
            <Link
              color="primary"
              underline="hover"
              onClick={(e) => {
                e.preventDefault();
                setHelpInfo({ title: "NodePlayground", content: helpContent });
                openHelp();
              }}
            >
              docs
            </Link>
            , or just create a new script.
          </Typography>
          <Button
            color="inherit"
            variant="contained"
            onClick={() => addNewNode()}
            startIcon={<AddIcon />}
          >
            New script
          </Button>
        </Stack>
      </Container>
    </EmptyState>
  );
};

const EMPTY_USER_NODES: UserNodes = Object.freeze({});

const userNodeSelector = (state: LayoutState) =>
  state.selectedLayout?.data?.userNodes ?? EMPTY_USER_NODES;

function NodePlayground(props: Props) {
  const { config, saveConfig } = props;
  const { autoFormatOnSave = false, selectedNodeId, editorForStorybook } = config;
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
      : "script name";
  });

  const prefersDarkMode = theme.palette.mode === "dark";

  const inputStyle = {
    backgroundColor: theme.palette.background[prefersDarkMode ? "default" : "paper"],
    width: `${Math.max(inputTitle.length + 4, 10)}ch`, // Width based on character count of title + padding
  };

  const actionHandler = useCallback(
    (action: SettingsTreeAction) => {
      if (action.action !== "update") {
        return;
      }

      const { input, value, path } = action.payload;
      if (input === "boolean" && path[1] === "autoFormatOnSave") {
        saveConfig({ autoFormatOnSave: value });
      }
    },
    [saveConfig],
  );

  useEffect(() => {
    updatePanelSettingsTree({
      actionHandler,
      nodes: buildSettingsTree(config),
    });
  }, [actionHandler, config, updatePanelSettingsTree]);

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
        : "script name";
    });
  }, [currentScript]);

  const saveCurrentNode = useCallback(() => {
    if (
      selectedNodeId != undefined &&
      selectedNode &&
      currentScript &&
      isCurrentScriptSelectedNode
    ) {
      setUserNodes({
        [selectedNodeId]: { ...selectedNode, sourceCode: currentScript.code },
      });
    }
  }, [currentScript, isCurrentScriptSelectedNode, selectedNode, selectedNodeId, setUserNodes]);

  const addNewNode = React.useCallback(
    (code?: string) => {
      saveCurrentNode();
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
    [saveConfig, saveCurrentNode, setUserNodes],
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
    <Stack fullHeight>
      <PanelToolbar helpContent={helpContent} />
      <Divider />
      <Stack direction="row" fullHeight overflow="hidden">
        <Sidebar
          explorer={explorer}
          updateExplorer={updateExplorer}
          selectNode={(nodeId) => {
            saveCurrentNode();
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
        <Stack
          flexGrow={1}
          fullHeight
          overflow="hidden"
          style={{
            backgroundColor: theme.palette.background[prefersDarkMode ? "paper" : "default"],
          }}
        >
          <Stack direction="row" alignItems="center">
            {scriptBackStack.length > 1 && (
              <IconButton title="Go back" data-testid="go-back" size="small" onClick={goBack}>
                <ArrowBackIcon />
              </IconButton>
            )}
            {selectedNodeId != undefined && selectedNode && (
              <div style={{ position: "relative" }}>
                <StyledInput
                  size="small"
                  disableUnderline
                  placeholder="script name"
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
            <IconButton
              title="New node"
              data-testid="new-node"
              size="small"
              onClick={() => addNewNode()}
            >
              <AddIcon />
            </IconButton>
          </Stack>

          <Stack flexGrow={1} overflow="hidden ">
            {selectedNodeId == undefined && <WelcomeScreen addNewNode={addNewNode} />}
            <Stack
              flexGrow={1}
              fullWidth
              overflow="hidden"
              style={{
                display: selectedNodeId != undefined ? "flex" : "none",
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
                    fullHeight
                    fullWidth
                    style={{
                      backgroundColor:
                        theme.palette.background[prefersDarkMode ? "default" : "paper"],
                    }}
                  >
                    <CircularProgress size={28} />
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
            </Stack>
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
