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

import ArrowLeftIcon from "@mdi/svg/svg/arrow-left.svg";
import CheckboxBlankOutlineIcon from "@mdi/svg/svg/checkbox-blank-outline.svg";
import CheckboxMarkedIcon from "@mdi/svg/svg/checkbox-marked.svg";
import PlusIcon from "@mdi/svg/svg/plus.svg";
import { Suspense } from "react";
import { useSelector, useDispatch } from "react-redux";
import styled from "styled-components";
import { v4 as uuidv4 } from "uuid";

import { Script } from "./script";
import { setUserNodes as setUserNodesAction } from "@foxglove-studio/app/actions/panels";
import Button from "@foxglove-studio/app/components/Button";
import Dimensions from "@foxglove-studio/app/components/Dimensions";
import Flex from "@foxglove-studio/app/components/Flex";
import Icon from "@foxglove-studio/app/components/Icon";
import Item from "@foxglove-studio/app/components/Menu/Item";
import Panel from "@foxglove-studio/app/components/Panel";
import PanelToolbar from "@foxglove-studio/app/components/PanelToolbar";
import SpinningLoadingIcon from "@foxglove-studio/app/components/SpinningLoadingIcon";
import TextContent from "@foxglove-studio/app/components/TextContent";
import BottomBar from "@foxglove-studio/app/panels/NodePlayground/BottomBar";
import Sidebar from "@foxglove-studio/app/panels/NodePlayground/Sidebar";
import Playground from "@foxglove-studio/app/panels/NodePlayground/playground-icon.svg";
import { UserNodes } from "@foxglove-studio/app/types/panels";
import { DEFAULT_WEBVIZ_NODE_PREFIX } from "@foxglove-studio/app/util/globalConstants";
import { colors } from "@foxglove-studio/app/util/sharedStyleConstants";

const Editor = React.lazy(() => import("@foxglove-studio/app/panels/NodePlayground/Editor"));

const skeletonBody = `import { Input, Messages } from "ros";

type Output = {};
type GlobalVariables = { id: number };

export const inputs = [];
export const output = "${DEFAULT_WEBVIZ_NODE_PREFIX}";

// Populate 'Input' with a parameter to properly type your inputs, e.g. 'Input<"/your_input_topic">'
const publisher = (message: Input<>, globalVars: GlobalVariables): Output => {
  return {};
};

export default publisher;`;

type Config = {
  selectedNodeId?: string;
  // Used only for storybook screenshot testing.
  editorForStorybook?: React.ReactNode;
  // Used only for storybook screenshot testing.
  additionalBackStackItems?: Script[];
  vimMode: boolean;
  autoFormatOnSave?: boolean;
};

type Props = {
  config: Config;
  saveConfig: (arg0: Partial<Config>) => void;
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

// Exported for screenshot testing.
export const NodePlaygroundSettings = ({ config, saveConfig }: Props) => (
  <>
    <Item
      icon={config.autoFormatOnSave ? <CheckboxMarkedIcon /> : <CheckboxBlankOutlineIcon />}
      onClick={() => saveConfig({ autoFormatOnSave: !config.autoFormatOnSave })}
    >
      <span>Auto-format on save</span>
    </Item>
    <Item
      icon={config.vimMode ? <CheckboxMarkedIcon /> : <CheckboxBlankOutlineIcon />}
      onClick={() => saveConfig({ vimMode: !config.vimMode })}
    >
      <span>Vim Mode</span>
    </Item>
  </>
);

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

export type Explorer = null | "docs" | "nodes" | "utils" | "templates";

const WelcomeScreen = ({
  addNewNode,
  updateExplorer,
}: {
  addNewNode: () => void;
  updateExplorer: (explorer: Explorer) => void;
}) => {
  return (
    <SWelcomeScreen>
      <Playground />
      <TextContent>
        Welcome to Node Playground! Get started by reading the{" "}
        <a
          href=""
          onClick={(e) => {
            e.preventDefault();
            updateExplorer("docs");
          }}
        >
          docs
        </a>
        , or just create a new node.
      </TextContent>
      <Button style={{ marginTop: "8px" }} onClick={addNewNode}>
        <Icon medium>
          <PlusIcon />
        </Icon>{" "}
        New node
      </Button>
    </SWelcomeScreen>
  );
};

function NodePlayground(props: Props) {
  const { config, saveConfig } = props;
  const { autoFormatOnSave, selectedNodeId, editorForStorybook, vimMode } = config;

  const [explorer, updateExplorer] = React.useState<Explorer>(null);

  const userNodes = useSelector((state: any) => state.persistedState.panels.userNodes);
  const userNodeDiagnostics = useSelector((state: any) => state.userNodes.userNodeDiagnostics);
  const rosLib = useSelector((state: any) => state.userNodes.rosLib);

  const dispatch = useDispatch();
  const setUserNodes = React.useCallback(
    (payload: UserNodes) => dispatch(setUserNodesAction(payload)),
    [dispatch],
  );

  const selectedNodeDiagnostics =
    selectedNodeId && userNodeDiagnostics[selectedNodeId]
      ? userNodeDiagnostics[selectedNodeId].diagnostics
      : [];
  const selectedNode = selectedNodeId ? userNodes[selectedNodeId] : undefined;
  const [scriptBackStack, setScriptBackStack] = React.useState<Script[]>([]);
  // Holds the currently active script
  const currentScript =
    scriptBackStack.length > 0 ? scriptBackStack[scriptBackStack.length - 1] : undefined;
  const isCurrentScriptSelectedNode =
    !!selectedNode && !!currentScript && currentScript.filePath === selectedNode.name;
  const isNodeSaved =
    !isCurrentScriptSelectedNode || currentScript?.code === selectedNode?.sourceCode;
  const selectedNodeLogs =
    selectedNodeId && userNodeDiagnostics[selectedNodeId]
      ? userNodeDiagnostics[selectedNodeId].logs
      : [];

  const inputTitle = currentScript
    ? currentScript.filePath + (currentScript.readOnly ? " (READONLY)" : "")
    : "node name";
  const inputStyle = {
    borderRadius: 0,
    margin: 0,
    backgroundColor: colors.DARK2,
    padding: "4px 20px",
    width: `${inputTitle.length + 4}ch`, // Width based on character count of title + padding
  };

  React.useLayoutEffect(() => {
    if (selectedNode) {
      const testItems = props.config.additionalBackStackItems || [];
      setScriptBackStack([
        { filePath: selectedNode.name, code: selectedNode.sourceCode, readOnly: false },
        ...testItems,
      ]);
    }
  }, [props.config.additionalBackStackItems, selectedNode]);

  const addNewNode = React.useCallback(
    (_, code?: string) => {
      const newNodeId = uuidv4();
      const sourceCode = code || skeletonBody;
      // TODO: Add integration test for this flow.
      setUserNodes({
        [newNodeId]: {
          sourceCode,
          name: `${DEFAULT_WEBVIZ_NODE_PREFIX}${newNodeId.split("-")[0]}`,
        },
      });
      saveConfig({ selectedNodeId: newNodeId });
    },
    [saveConfig, setUserNodes],
  );

  const saveNode = React.useCallback(
    (script) => {
      if (!selectedNodeId || !script) {
        return;
      }
      setUserNodes({ [selectedNodeId]: { ...selectedNode, sourceCode: script } });
    },
    [selectedNode, selectedNodeId, setUserNodes],
  );

  const setScriptOverride = React.useCallback(
    (script: Script, maxDepth?: number) => {
      if (maxDepth && scriptBackStack.length >= maxDepth) {
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
        if (!script?.readOnly) {
          setScriptBackStack([...backStack, { ...script, code }] as any);
        }
      }
    },
    [scriptBackStack],
  );

  return (
    <Dimensions>
      {({ height, width }) => (
        <Flex col style={{ height, position: "relative" }}>
          <PanelToolbar floating menuContent={<NodePlaygroundSettings {...props} />} />
          <Flex style={{ height, width }}>
            <Sidebar
              explorer={explorer}
              updateExplorer={updateExplorer}
              selectNode={(nodeId) => {
                if (selectedNodeId && currentScript && isCurrentScriptSelectedNode) {
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
              userNodeDiagnostics={userNodeDiagnostics}
              script={currentScript}
              setScriptOverride={setScriptOverride}
              addNewNode={addNewNode}
            />
            <Flex col>
              <Flex
                start
                style={{
                  flexGrow: 0,
                  backgroundColor: colors.DARK1,
                  alignItems: "center",
                }}
              >
                {scriptBackStack.length > 1 && (
                  <Icon
                    large
                    tooltip="Go back"
                    dataTest="go-back"
                    style={{ color: colors.DARK9 }}
                    onClick={goBack}
                  >
                    <ArrowLeftIcon />
                  </Icon>
                )}
                {selectedNodeId && (
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      placeholder="node name"
                      value={inputTitle}
                      disabled={!currentScript || currentScript.readOnly}
                      style={inputStyle}
                      spellCheck={false}
                      onChange={(e) => {
                        const newNodeName = e.target.value;
                        setUserNodes({
                          ...userNodes,
                          [selectedNodeId]: { ...selectedNode, name: newNodeName },
                        });
                      }}
                    />
                    <UnsavedDot isSaved={isNodeSaved} />
                  </div>
                )}
                <Icon
                  large
                  tooltip="new node"
                  dataTest="new-node"
                  style={{ color: colors.DARK9, padding: "0 5px" }}
                  onClick={addNewNode}
                >
                  <PlusIcon />
                </Icon>
              </Flex>

              <Flex col style={{ flexGrow: 1, position: "relative" }}>
                {!selectedNodeId && (
                  <WelcomeScreen addNewNode={addNewNode as any} updateExplorer={updateExplorer} />
                )}
                <div
                  key={`${height}x${width}`}
                  data-nativeundoredo="true"
                  style={{
                    height: "100%",
                    width: "100%",
                    display: selectedNodeId ? "initial" : "none",
                    /* Ensures the monaco-editor starts loading before the user opens it */
                  }}
                >
                  <Suspense
                    fallback={
                      <Flex center style={{ width: "100%", height: "100%" }}>
                        <Icon large>
                          <SpinningLoadingIcon />
                        </Icon>
                      </Flex>
                    }
                  >
                    {editorForStorybook || (
                      <Editor
                        autoFormatOnSave={!!autoFormatOnSave}
                        script={currentScript}
                        setScriptCode={setScriptCode}
                        setScriptOverride={setScriptOverride}
                        vimMode={vimMode}
                        rosLib={rosLib}
                        resizeKey={`${width}-${height}-${explorer || "none"}-${
                          selectedNodeId || "none"
                        }`}
                        save={saveNode}
                      />
                    )}
                  </Suspense>
                </div>
                <BottomBar
                  nodeId={selectedNodeId}
                  isSaved={isNodeSaved}
                  save={() => saveNode(currentScript?.code)}
                  diagnostics={selectedNodeDiagnostics}
                  logs={selectedNodeLogs}
                />
              </Flex>
            </Flex>
          </Flex>
        </Flex>
      )}
    </Dimensions>
  );
}

NodePlayground.panelType = "NodePlayground";
NodePlayground.defaultConfig = {
  selectedNodeId: undefined,
  vimMode: false,
  autoFormatOnSave: true,
};

export default Panel<Config>(NodePlayground as any);
