// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ArrowDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import {
  Divider,
  IconButton,
  ListItemProps,
  styled as muiStyled,
  Typography,
  useTheme,
} from "@mui/material";
import { useMemo, useState } from "react";
import { DeepReadonly } from "ts-essentials";

import Stack from "@foxglove/studio-base/components/Stack";

import { FieldEditor } from "./FieldEditor";
import { NodeActionsMenu } from "./NodeActionsMenu";
import { VisibilityToggle } from "./VisibilityToggle";
import icons from "./icons";
import { SettingsTreeAction, SettingsTreeNode } from "./types";

export type NodeEditorProps = {
  actionHandler: (action: SettingsTreeAction) => void;
  defaultOpen?: boolean;
  divider?: ListItemProps["divider"];
  group?: string;
  path: readonly string[];
  settings?: DeepReadonly<SettingsTreeNode>;
  updateSettings?: (path: readonly string[], value: unknown) => void;
};

const FieldPadding = muiStyled("div", { skipSx: true })(({ theme }) => ({
  gridColumn: "span 2",
  height: theme.spacing(0.5),
}));

const NodeHeader = muiStyled("div")(({ theme }) => {
  return {
    display: "flex",
    gridColumn: "span 2",
    paddingRight: theme.spacing(1.5),

    "&:hover": {
      outline: `1px solid ${theme.palette.primary.main}`,
      outlineOffset: -1,
    },
  };
});

const NodeHeaderToggle = muiStyled("div", {
  shouldForwardProp: (prop) => prop !== "indent" && prop !== "visible",
})<{ indent: number; visible: boolean }>(({ theme, indent, visible }) => {
  return {
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    marginLeft: theme.spacing(1.5 + 2 * indent),
    opacity: visible ? 1 : 0.6,
    position: "relative",
    userSelect: "none",
    width: "100%",
  };
});

const IconWrapper = muiStyled("div")({
  position: "absolute",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  top: "50%",
  left: 0,
  transform: "translate(-125%, -50%)",
});

function ExpansionArrow({ expanded }: { expanded: boolean }): JSX.Element {
  const Component = expanded ? ArrowDownIcon : ArrowRightIcon;
  return (
    <IconWrapper>
      <Component />
    </IconWrapper>
  );
}

function NodeEditorComponent(props: NodeEditorProps): JSX.Element {
  const { actionHandler, defaultOpen = true, settings = {} } = props;
  const [open, setOpen] = useState(defaultOpen);

  const theme = useTheme();
  const indent = props.path.length;
  const allowVisibilityToggle = props.settings?.visible != undefined;
  const visible = props.settings?.visible !== false;

  const toggleVisibility = () => {
    actionHandler({
      action: "update",
      payload: { input: "boolean", path: [...props.path, "visible"], value: !visible },
    });
  };

  const handleNodeAction = (actionId: string) => {
    actionHandler({ action: "perform-node-action", payload: { id: actionId, path: props.path } });
  };

  const { fields, children } = settings;
  const hasProperties = fields != undefined || children != undefined;

  // Provide stable subpaths so that memoization works.
  const stablePaths = useMemo<Record<string, readonly string[]>>(
    () => ({ "": props.path }),
    [props.path],
  );

  const fieldEditors = Object.entries(fields ?? {}).map(([key, field]) => {
    const stablePath = (stablePaths[key] ??= [...props.path, key]);
    return <FieldEditor key={key} field={field} path={stablePath} actionHandler={actionHandler} />;
  });

  const childNodes = Object.entries(children ?? {}).map(([key, child]) => {
    const stablePath = (stablePaths[key] ??= [...props.path, key]);
    return (
      <NodeEditor
        actionHandler={actionHandler}
        defaultOpen={child.defaultExpansionState === "collapsed" ? false : true}
        key={key}
        settings={child}
        path={stablePath}
      />
    );
  });

  const IconComponent =
    settings.icon != undefined
      ? icons[settings.icon] // if the icon is a custom icon, use it
      : childNodes.length > 0
      ? open // if there are children, use the folder icon
        ? icons.FolderOpen
        : icons.Folder
      : open // if there are no children, use the note icon
      ? icons.Note
      : icons.NoteFilled;

  return (
    <>
      <NodeHeader>
        <NodeHeaderToggle indent={indent} onClick={() => setOpen(!open)} visible={visible}>
          {hasProperties && <ExpansionArrow expanded={open} />}
          <IconComponent
            fontSize="small"
            color="inherit"
            style={{
              marginRight: theme.spacing(0.5),
              marginLeft: theme.spacing(-0.75),
              opacity: 0.8,
            }}
          />
          <Typography
            noWrap={true}
            variant="subtitle2"
            fontWeight={600}
            color={visible ? "text.primary" : "text.disabled"}
          >
            {settings.label ?? "General"}
          </Typography>
        </NodeHeaderToggle>
        <Stack alignItems="center" direction="row">
          {/* this is just here to get consistent height */}
          <IconButton style={{ visibility: "hidden" }}>
            <ArrowDownIcon fontSize="small" color="inherit" />
          </IconButton>
          {settings.actions && (
            <NodeActionsMenu actions={settings.actions} onSelectAction={handleNodeAction} />
          )}
          {settings.visible != undefined && (
            <VisibilityToggle
              edge="end"
              size="small"
              checked={visible}
              onChange={toggleVisibility}
              style={{ opacity: allowVisibilityToggle ? 1 : 0 }}
              disabled={!allowVisibilityToggle}
            />
          )}
        </Stack>
      </NodeHeader>
      {open && fieldEditors.length > 0 && (
        <>
          <FieldPadding />
          {fieldEditors}
          <FieldPadding />
        </>
      )}
      {open && childNodes}
      {indent === 1 && <Divider style={{ gridColumn: "span 2" }} />}
    </>
  );
}

export const NodeEditor = React.memo(NodeEditorComponent);
