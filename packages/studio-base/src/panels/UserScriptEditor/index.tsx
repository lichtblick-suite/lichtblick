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
  Link,
  Typography,
} from "@mui/material";
import { Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ImperativePanelHandle,
  PanelGroup,
  PanelResizeHandle,
  Panel as ResizablePanel,
} from "react-resizable-panels";
import tc from "tinycolor2";
import { makeStyles } from "tss-react/mui";
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
import { useUserScriptState } from "@foxglove/studio-base/context/UserScriptStateContext";
import BottomBar from "@foxglove/studio-base/panels/UserScriptEditor/BottomBar";
import { Sidebar } from "@foxglove/studio-base/panels/UserScriptEditor/Sidebar";
import { usePanelSettingsTreeUpdate } from "@foxglove/studio-base/providers/PanelStateContextProvider";
import { SaveConfig, UserScripts } from "@foxglove/studio-base/types/panels";

import Config from "./Config";
import { Script } from "./script";

const Editor = React.lazy(
  async () => await import("@foxglove/studio-base/panels/UserScriptEditor/Editor"),
);

const skeletonBody = `\
// The ./types module provides helper types for your Input events and messages.
import { Input, Message } from "./types";

// Your script can output well-known message types, any of your custom message types, or
// complete custom message types.
//
// Use \`Message\` to access types from the schemas defined in your data source:
// type Twist = Message<"geometry_msgs/Twist">;
//
// Import from the @foxglove/schemas package to use foxglove schema types:
// import { Pose, LocationFix } from "@foxglove/schemas";
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

const useStyles = makeStyles()((theme) => ({
  emptyState: {
    backgroundColor: theme.palette.background.default,
  },
  resizeHandle: {
    position: "relative",
    height: 10,
    marginTop: -10,

    ":hover": {
      backgroundPosition: "50% 0",
      backgroundSize: "100% 50px",
      backgroundImage: `radial-gradient(${[
        "at center center",
        `${theme.palette.action.focus} 0%`,
        "transparent 70%",
        "transparent 100%",
      ].join(",")})`,
      boxShadow: `0 2px 0 0 ${
        theme.palette.mode === "dark"
          ? tc(theme.palette.divider).lighten().toString()
          : tc(theme.palette.divider).darken().toString()
      }`,
    },
  },
}));

function buildSettingsTree(config: Config): SettingsTreeNodes {
  return {
    general: {
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

const WelcomeScreen = ({ addNewNode }: { addNewNode: (code?: string) => void }) => {
  const { classes } = useStyles();
  return (
    <EmptyState className={classes.emptyState}>
      <Container maxWidth="xs">
        <Stack justifyContent="center" alignItems="center" gap={1} fullHeight>
          <Typography variant="inherit" gutterBottom>
            Welcome to User Scripts!
            <br />
            Get started by reading the{" "}
            <Link
              color="primary"
              underline="hover"
              href="https://foxglove.dev/docs/studio/panels/user-scripts"
              target="_blank"
            >
              docs
            </Link>
            , or just create a new script.
          </Typography>
          <Button
            color="inherit"
            variant="contained"
            onClick={() => {
              addNewNode();
            }}
            startIcon={<AddIcon />}
          >
            New script
          </Button>
        </Stack>
      </Container>
    </EmptyState>
  );
};

const EMPTY_USER_NODES: UserScripts = Object.freeze({});

const selectUserScripts = (state: LayoutState) =>
  state.selectedLayout?.data?.userNodes ?? EMPTY_USER_NODES;

function UserScriptEditor(props: Props) {
  const { config, saveConfig } = props;
  const { classes, theme } = useStyles();
  const { autoFormatOnSave = false, selectedNodeId, editorForStorybook } = config;
  const updatePanelSettingsTree = usePanelSettingsTreeUpdate();

  const userScripts = useCurrentLayoutSelector(selectUserScripts);
  const {
    state: { scriptStates: userScriptStates, rosLib, typesLib },
  } = useUserScriptState();

  const { setUserScripts } = useCurrentLayoutActions();

  const selectedNodeDiagnostics =
    (selectedNodeId != undefined ? userScriptStates[selectedNodeId]?.diagnostics : undefined) ?? [];
  const selectedScript = selectedNodeId != undefined ? userScripts[selectedNodeId] : undefined;
  const [scriptBackStack, setScriptBackStack] = useState<Script[]>([]);
  // Holds the currently active script
  const currentScript =
    scriptBackStack.length > 0 ? scriptBackStack[scriptBackStack.length - 1] : undefined;
  const isCurrentScriptSelectedNode =
    !!selectedScript && !!currentScript && currentScript.filePath === selectedScript.name;
  const isNodeSaved =
    !isCurrentScriptSelectedNode || currentScript.code === selectedScript.sourceCode;
  const selectedNodeLogs =
    (selectedNodeId != undefined ? userScriptStates[selectedNodeId]?.logs : undefined) ?? [];

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

  useLayoutEffect(() => {
    if (selectedScript) {
      const testItems = props.config.additionalBackStackItems ?? [];
      setScriptBackStack([
        { filePath: selectedScript.name, code: selectedScript.sourceCode, readOnly: false },
        ...testItems,
      ]);
    }
  }, [props.config.additionalBackStackItems, selectedScript]);

  useLayoutEffect(() => {
    setInputTitle(() => {
      return currentScript
        ? currentScript.filePath + (currentScript.readOnly ? " (READONLY)" : "")
        : "script name";
    });
  }, [currentScript]);

  const saveCurrentNode = useCallback(() => {
    if (
      selectedNodeId != undefined &&
      selectedScript &&
      currentScript &&
      isCurrentScriptSelectedNode
    ) {
      setUserScripts({
        [selectedNodeId]: { ...selectedScript, sourceCode: currentScript.code },
      });
    }
  }, [currentScript, isCurrentScriptSelectedNode, selectedScript, selectedNodeId, setUserScripts]);

  const addNewNode = useCallback(
    (code?: string) => {
      saveCurrentNode();
      const newScriptId = uuidv4();
      const sourceCode = code ?? skeletonBody;
      setUserScripts({
        [newScriptId]: {
          sourceCode,
          name: `${newScriptId.split("-")[0]}`,
        },
      });
      saveConfig({ selectedNodeId: newScriptId });
    },
    [saveConfig, saveCurrentNode, setUserScripts],
  );

  const saveNode = useCallback(
    (script: string | undefined) => {
      if (selectedNodeId == undefined || script == undefined || script === "" || !selectedScript) {
        return;
      }
      setUserScripts({ [selectedNodeId]: { ...selectedScript, sourceCode: script } });
    },
    [selectedScript, selectedNodeId, setUserScripts],
  );

  const setScriptOverride = useCallback(
    (script: Script, maxDepth?: number) => {
      if (maxDepth != undefined && maxDepth > 0 && scriptBackStack.length >= maxDepth) {
        setScriptBackStack([...scriptBackStack.slice(0, maxDepth - 1), script]);
      } else {
        setScriptBackStack([...scriptBackStack, script]);
      }
    },
    [scriptBackStack],
  );

  const goBack = useCallback(() => {
    setScriptBackStack(scriptBackStack.slice(0, scriptBackStack.length - 1));
  }, [scriptBackStack]);

  const setScriptCode = useCallback(
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

  const saveOnLeave = useCallback(() => {
    if (isNodeSaved) {
      return;
    }
    // automatically save script on panel leave
    saveCurrentNode();
  }, [isNodeSaved, saveCurrentNode]);

  // The cleanup function below should only run when this component unmounts.
  // We're using a ref here so that the cleanup useEffect doesn't run whenever one of the callback
  // dependencies changes, only when the component unmounts and with the most up-to-date callback.
  const saveOnLeaveRef = useRef(saveOnLeave);
  saveOnLeaveRef.current = saveOnLeave;
  useEffect(() => {
    return () => {
      saveOnLeaveRef.current();
    };
  }, []);

  const bottomBarRef = useRef<ImperativePanelHandle>(ReactNull);

  const onChangeBottomBarTab = useCallback(() => {
    bottomBarRef.current?.expand();
  }, []);

  return (
    <Stack fullHeight>
      <PanelToolbar />
      <Divider />
      <Stack direction="row" fullHeight overflow="hidden">
        <Sidebar
          selectScript={(scriptId) => {
            saveCurrentNode();
            saveConfig({ selectedNodeId: scriptId });
          }}
          deleteScript={(scriptId) => {
            setUserScripts({ ...userScripts, [scriptId]: undefined });
            saveConfig({
              selectedNodeId:
                Object.keys(userScripts).length > 1 ? Object.keys(userScripts)[0] : undefined,
            });
          }}
          selectedScriptId={selectedNodeId}
          userScripts={userScripts}
          script={currentScript}
          setScriptOverride={setScriptOverride}
          setUserScripts={setUserScripts}
          selectedScript={selectedScript}
          addNewScript={addNewNode}
        />
        <Stack
          flexGrow={1}
          fullHeight
          overflow="hidden"
          style={{
            backgroundColor: theme.palette.background[prefersDarkMode ? "paper" : "default"],
          }}
        >
          {scriptBackStack.length > 1 && (
            <Stack direction="row" alignItems="center" gap={1}>
              {scriptBackStack.length > 1 && (
                <IconButton title="Go back" data-testid="go-back" size="small" onClick={goBack}>
                  <ArrowBackIcon />
                </IconButton>
              )}
              {selectedNodeId != undefined && selectedScript && (
                <div style={{ position: "relative" }}>{inputTitle}</div>
              )}
            </Stack>
          )}

          <PanelGroup direction="vertical" units="pixels">
            {selectedNodeId == undefined && <WelcomeScreen addNewNode={addNewNode} />}
            <ResizablePanel>
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
            </ResizablePanel>
            <PanelResizeHandle className={classes.resizeHandle} />
            <ResizablePanel
              collapsible
              minSize={38}
              collapsedSize={38}
              defaultSize={38}
              ref={bottomBarRef}
            >
              <BottomBar
                diagnostics={selectedNodeDiagnostics}
                isSaved={isNodeSaved}
                logs={selectedNodeLogs}
                scriptId={selectedNodeId}
                onChangeTab={onChangeBottomBarTab}
                save={() => {
                  saveNode(currentScript?.code);
                }}
              />
            </ResizablePanel>
          </PanelGroup>
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
  Object.assign(UserScriptEditor, {
    panelType: "NodePlayground",
    defaultConfig,
  }),
);
