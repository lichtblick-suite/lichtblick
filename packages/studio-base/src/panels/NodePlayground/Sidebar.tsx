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

import CloseIcon from "@mui/icons-material/Close";
import ConstructionOutlinedIcon from "@mui/icons-material/ConstructionOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import TemplateIcon from "@mui/icons-material/PhotoFilter";
import NoteIcon from "@mui/icons-material/StickyNote2Outlined";
import {
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Tabs,
  Tab,
  Paper,
  CardHeader,
  Typography,
  Divider,
  tabClasses,
} from "@mui/material";
import * as monacoApi from "monaco-editor/esm/vs/editor/editor.api";
import { ReactNode, useCallback, useMemo } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";
import { Explorer } from "@foxglove/studio-base/panels/NodePlayground";
import { Script } from "@foxglove/studio-base/panels/NodePlayground/script";
import { getNodeProjectConfig } from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/projectConfig";
import templates from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/templates";
import { UserNodes } from "@foxglove/studio-base/types/panels";

const useStyles = makeStyles()((theme) => ({
  tabs: {
    [`.${tabClasses.root}`]: {
      minWidth: "auto",
      padding: theme.spacing(1, 1.125),
    },
  },
  explorerWrapper: {
    backgroundColor: theme.palette.background.paper,
    width: 350,
    overflow: "auto",
  },
}));

type NodesListProps = {
  nodes: UserNodes;
  selectNode: (id: string) => void;
  deleteNode: (id: string) => void;
  collapse: () => void;
  selectedNodeId?: string;
};

const NodesList = ({ nodes, selectNode, deleteNode, collapse, selectedNodeId }: NodesListProps) => {
  return (
    <Stack flex="auto">
      <SidebarHeader title="Scripts" collapse={collapse} />
      <List dense>
        {Object.keys(nodes).map((nodeId) => {
          return (
            <ListItem
              disablePadding
              key={nodeId}
              secondaryAction={
                <IconButton
                  size="small"
                  onClick={() => deleteNode(nodeId)}
                  edge="end"
                  aria-label="delete"
                  title="Delete"
                  color="error"
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemButton
                selected={selectedNodeId === nodeId}
                onClick={() => selectNode(nodeId)}
              >
                <ListItemText
                  primary={nodes[nodeId]?.name}
                  primaryTypographyProps={{ variant: "body1" }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Stack>
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

const SidebarHeader = ({
  title,
  subheader,
  collapse,
}: {
  title: string;
  subheader?: ReactNode;
  collapse: () => void;
}) => (
  <CardHeader
    title={title}
    titleTypographyProps={{
      variant: "h5",
      gutterBottom: true,
    }}
    subheader={subheader}
    subheaderTypographyProps={{
      variant: "body2",
      color: "text.secondary",
    }}
    action={
      <IconButton size="small" onClick={collapse} title="Collapse">
        <CloseIcon />
      </IconButton>
    }
  />
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
  const { classes } = useStyles();
  const nodesSelected = explorer === "nodes";
  const utilsSelected = explorer === "utils";
  const templatesSelected = explorer === "templates";

  const gotoUtils = useCallback(
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

  const activeExplorerTab = useMemo(() => {
    switch (explorer) {
      case undefined:
        return false;
      case "nodes":
        return "nodes";
      case "templates":
        return "templates";
      case "utils":
        return "utils";
    }
    return false;
  }, [explorer]);

  const explorers = useMemo(
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
        <Stack flex="auto" position="relative">
          <SidebarHeader
            collapse={() => updateExplorer(undefined)}
            title="Utilities"
            subheader={
              <Typography variant="body2" color="text.secondary">
                You can import any of these modules into your script using the following syntax:{" "}
                <pre>{`import { ... } from "./pointClouds.ts".`}</pre>
              </Typography>
            }
          />
          <List dense>
            {utilityFiles.map(({ fileName, filePath }) => (
              <ListItem
                disablePadding
                key={filePath}
                onClick={gotoUtils.bind(undefined, filePath)}
                selected={script ? filePath === script.filePath : false}
              >
                <ListItemButton>
                  <ListItemText primary={fileName} primaryTypographyProps={{ variant: "body1" }} />
                </ListItemButton>
              </ListItem>
            ))}
            <ListItem
              disablePadding
              onClick={gotoUtils.bind(undefined, "/studio_script/generatedTypes.ts")}
              selected={script ? script.filePath === "/studio_script/generatedTypes.ts" : false}
            >
              <ListItemButton>
                <ListItemText
                  primary="generatedTypes.ts"
                  primaryTypographyProps={{ variant: "body1" }}
                />
              </ListItemButton>
            </ListItem>
          </List>
        </Stack>
      ),
      templates: (
        <Stack flex="auto">
          <SidebarHeader
            title="Templates"
            subheader="Create scripts from these templates, click a template to create a new script."
            collapse={() => updateExplorer(undefined)}
          />
          <List dense>
            {templates.map(({ name, description, template }) => (
              <ListItem disablePadding key={name} onClick={() => addNewNode(template)}>
                <ListItemButton>
                  <ListItemText
                    primary={name}
                    primaryTypographyProps={{ variant: "body1" }}
                    secondary={description}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Stack>
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
    <Paper elevation={0}>
      <Stack direction="row" fullHeight>
        <Tabs className={classes.tabs} orientation="vertical" value={activeExplorerTab}>
          <Tab
            disableRipple
            value="nodes"
            title="Scripts"
            icon={<NoteIcon fontSize="large" />}
            data-testid="node-explorer"
            onClick={() => updateExplorer(nodesSelected ? undefined : "nodes")}
          />
          <Tab
            disableRipple
            value="utils"
            title="Utilities"
            icon={<ConstructionOutlinedIcon fontSize="large" />}
            data-testid="utils-explorer"
            onClick={() => updateExplorer(utilsSelected ? undefined : "utils")}
          />
          <Tab
            disableRipple
            value="templates"
            title="Templates"
            icon={<TemplateIcon fontSize="large" />}
            data-testid="templates-explorer"
            onClick={() => updateExplorer(templatesSelected ? undefined : "templates")}
          />
        </Tabs>
        {explorer != undefined && (
          <>
            <Divider flexItem orientation="vertical" />
            <div className={classes.explorerWrapper}>{explorers[explorer]}</div>
          </>
        )}
        <Divider flexItem orientation="vertical" />
      </Stack>
    </Paper>
  );
};

export default Sidebar;
