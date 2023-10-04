// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import AddIcon from "@mui/icons-material/Add";
import { Button, List } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";
import { UserNode, UserNodes } from "@foxglove/studio-base/types/panels";

import { NodeListItem } from "./NodeListItem";
import { SidebarHeader } from "./SidebarHeader";

const useStyles = makeStyles()((theme) => ({
  buttonRow: {
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(1, 1.125),
  },
}));

type NodesListProps = {
  nodes: UserNodes;
  addNewNode: () => void;
  selectNode: (id: string) => void;
  deleteNode: (id: string) => void;
  onClose: () => void;
  selectedNodeId?: string;
  selectedNode?: UserNode;
  setUserNodes: (nodes: Partial<UserNodes>) => void;
};

export function NodesList({
  nodes,
  addNewNode,
  selectNode,
  deleteNode,
  onClose,
  selectedNodeId,
  selectedNode,
  setUserNodes,
}: NodesListProps): JSX.Element {
  const { classes } = useStyles();

  return (
    <Stack flex="auto">
      <SidebarHeader title="Scripts" onClose={onClose} />
      <List>
        {Object.keys(nodes).map((nodeId) => {
          return (
            <NodeListItem
              key={nodeId}
              title={nodes[nodeId]?.name ?? "Untitled script"}
              selected={selectedNodeId === nodeId}
              onClick={() => {
                selectNode(nodeId);
              }}
              onDelete={() => {
                deleteNode(nodeId);
              }}
              onRename={(name: string) => {
                if (selectedNodeId != undefined && selectedNode != undefined) {
                  setUserNodes({
                    ...nodes,
                    [selectedNodeId]: { ...selectedNode, name },
                  });
                }
              }}
            />
          );
        })}
        <li className={classes.buttonRow}>
          <Button
            fullWidth
            startIcon={<AddIcon />}
            variant="contained"
            color="inherit"
            onClick={() => {
              addNewNode();
            }}
          >
            New script
          </Button>
        </li>
      </List>
    </Stack>
  );
}
