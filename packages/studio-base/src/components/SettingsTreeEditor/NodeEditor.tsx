// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ArrowDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import CheckIcon from "@mui/icons-material/Check";
import EditIcon from "@mui/icons-material/Edit";
import ErrorIcon from "@mui/icons-material/Error";
import { Divider, IconButton, TextField, Tooltip, Typography, useTheme } from "@mui/material";
import memoizeWeak from "memoize-weak";
import { ChangeEvent, useCallback } from "react";
import { DeepReadonly } from "ts-essentials";
import { makeStyles } from "tss-react/mui";
import { useImmer } from "use-immer";

import { filterMap } from "@foxglove/den/collection";
import { SettingsTreeAction, SettingsTreeNode } from "@foxglove/studio";
import { HighlightedText } from "@foxglove/studio-base/components/HighlightedText";
import Stack from "@foxglove/studio-base/components/Stack";

import { FieldEditor } from "./FieldEditor";
import { NodeActionsMenu } from "./NodeActionsMenu";
import { VisibilityToggle } from "./VisibilityToggle";
import { icons } from "./icons";
import { prepareSettingsNodes } from "./utils";

export type NodeEditorProps = {
  actionHandler: (action: SettingsTreeAction) => void;
  defaultOpen?: boolean;
  filter?: string;
  path: readonly string[];
  settings?: DeepReadonly<SettingsTreeNode>;
};

export const NODE_HEADER_MIN_HEIGHT = 35;

const useStyles = makeStyles()((theme) => ({
  editButton: {
    padding: theme.spacing(0.5),
  },
  editNameField: {
    font: "inherit",
    gridColumn: "span 2",
    width: "100%",

    ".MuiInputBase-input": {
      fontSize: "0.75rem",
      padding: theme.spacing(0.75, 1),
    },
  },
  fieldPadding: {
    gridColumn: "span 2",
    height: theme.spacing(0.5),
  },
  iconWrapper: {
    position: "absolute",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    top: "50%",
    left: 0,
    transform: "translate(-97.5%, -50%)",
  },

  nodeHeader: {
    display: "flex",
    gridColumn: "span 2",
    paddingRight: theme.spacing(0.5),
    minHeight: NODE_HEADER_MIN_HEIGHT,

    "@media (pointer: fine)": {
      ".MuiCheckbox-root": {
        visibility: "visible",
      },

      "[data-node-function=edit-label]": {
        visibility: "hidden",
      },

      "&:hover": {
        backgroundColor: theme.palette.action.hover,

        ".MuiCheckbox-root": {
          visibility: "visible",
        },

        "[data-node-function=edit-label]": {
          visibility: "visible",
        },
      },
    },
  },
  nodeHeaderVisible: {
    "@media (pointer: fine)": {
      ".MuiCheckbox-root": {
        visibility: "hidden",
      },
      "&:hover": {
        ".MuiCheckbox-root": {
          visibility: "visible",
        },
      },
    },
  },

  nodeHeaderToggle: {
    display: "grid",
    alignItems: "center",
    gridTemplateColumns: "auto 1fr auto",
    opacity: 0.6,
    position: "relative",
    userSelect: "none",
    width: "100%",
  },
  nodeHeaderToggleHasProperties: {
    cursor: "pointer",
  },
  nodeHeaderToggleVisible: {
    opacity: 1,
  },
  errorTooltip: {
    whiteSpace: "pre-line",
    maxHeight: "15vh",
    overflowY: "auto",
  },
}));

function ExpansionArrow({ expanded }: { expanded: boolean }): JSX.Element {
  const { classes } = useStyles();

  const Component = expanded ? ArrowDownIcon : ArrowRightIcon;
  return (
    <div className={classes.iconWrapper}>
      <Component />
    </div>
  );
}

const makeStablePath = memoizeWeak((path: readonly string[], key: string) => [...path, key]);

type SelectVisibilityFilterValue = "all" | "visible" | "invisible";
const SelectVisibilityFilterOptions: { label: string; value: SelectVisibilityFilterValue }[] = [
  { label: "List all", value: "all" },
  { label: "List visible", value: "visible" },
  { label: "List invisible", value: "invisible" },
];
function showVisibleFilter(child: DeepReadonly<SettingsTreeNode>): boolean {
  // want to show children with undefined visibility
  return child.visible !== false;
}
function showInvisibleFilter(child: DeepReadonly<SettingsTreeNode>): boolean {
  // want to show children with undefined visibility
  return child.visible !== true;
}
const SelectVisibilityFilterField = {
  input: "select",
  label: "Filter list",
  help: "Filter list by visibility",
  options: SelectVisibilityFilterOptions,
} as const;

function NodeEditorComponent(props: NodeEditorProps): JSX.Element {
  const { actionHandler, defaultOpen = true, filter, settings = {} } = props;
  const [state, setState] = useImmer({
    open: defaultOpen,
    editing: false,
    visibilityFilter: "all",
  });

  const { classes, cx } = useStyles();

  const theme = useTheme();
  const indent = props.path.length;
  const allowVisibilityToggle = props.settings?.visible != undefined;
  const visible = props.settings?.visible !== false;
  const selectVisibilityFilterEnabled = props.settings?.enableVisibilityFilter === true;

  const selectVisibilityFilter = (action: SettingsTreeAction) => {
    if (action.action === "update" && action.payload.input === "select") {
      setState((draft) => {
        draft.visibilityFilter = action.payload.value as SelectVisibilityFilterValue;
      });
    }
  };

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
  const hasChildren = children != undefined && Object.keys(children).length > 0;
  const hasProperties = fields != undefined || hasChildren;

  const fieldEditors = filterMap(Object.entries(fields ?? {}), ([key, field]) => {
    return field ? (
      <FieldEditor
        key={key}
        field={field}
        path={makeStablePath(props.path, key)}
        actionHandler={actionHandler}
      />
    ) : undefined;
  });

  const filterFn =
    state.visibilityFilter === "visible"
      ? showVisibleFilter
      : state.visibilityFilter === "invisible"
      ? showInvisibleFilter
      : undefined;
  const childNodes = filterMap(prepareSettingsNodes(children ?? {}), ([key, child]) => {
    return !filterFn || filterFn(child) ? (
      <NodeEditor
        actionHandler={actionHandler}
        defaultOpen={child.defaultExpansionState === "collapsed" ? false : true}
        filter={filter}
        key={key}
        settings={child}
        path={makeStablePath(props.path, key)}
      />
    ) : undefined;
  });

  const IconComponent = settings.icon ? icons[settings.icon] : undefined;

  const onEditLabel = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      if (settings.renamable === true) {
        actionHandler({
          action: "update",
          payload: { path: [...props.path, "label"], input: "string", value: event.target.value },
        });
      }
    },
    [actionHandler, props.path, settings.renamable],
  );

  const toggleEditing = useCallback(() => {
    setState((draft) => {
      draft.editing = !draft.editing;
    });
  }, [setState]);

  const toggleOpen = useCallback(() => {
    setState((draft) => {
      if (!draft.editing) {
        draft.open = !draft.open;
      }
    });
  }, [setState]);

  const onLabelKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === "Escape") {
        toggleEditing();
      }
    },
    [toggleEditing],
  );

  return (
    <>
      <div className={cx(classes.nodeHeader, { [classes.nodeHeaderVisible]: visible })}>
        <div
          className={cx(classes.nodeHeaderToggle, {
            [classes.nodeHeaderToggleHasProperties]: hasProperties,
            [classes.nodeHeaderToggleVisible]: visible,
          })}
          style={{
            marginLeft: theme.spacing(0.75 + 2 * indent),
          }}
          onClick={toggleOpen}
        >
          {hasProperties && <ExpansionArrow expanded={state.open} />}
          {IconComponent && (
            <IconComponent
              fontSize="small"
              color="inherit"
              style={{
                marginRight: theme.spacing(0.5),
                opacity: 0.8,
              }}
            />
          )}
          {state.editing ? (
            <TextField
              className={classes.editNameField}
              autoFocus
              variant="filled"
              onChange={onEditLabel}
              value={settings.label}
              onBlur={toggleEditing}
              onKeyDown={onLabelKeyDown}
              onFocus={(event) => event.target.select()}
              InputProps={{
                endAdornment: (
                  <IconButton
                    className={classes.editButton}
                    title="Rename"
                    data-node-function="edit-label"
                    color="primary"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleEditing();
                    }}
                  >
                    <CheckIcon fontSize="small" />
                  </IconButton>
                ),
              }}
            />
          ) : (
            <Typography
              noWrap={true}
              flex="auto"
              variant="subtitle2"
              fontWeight={indent < 2 ? 600 : 400}
              color={visible ? "text.primary" : "text.disabled"}
            >
              <HighlightedText text={settings.label ?? "General"} highlight={filter} />
            </Typography>
          )}
        </div>
        <Stack alignItems="center" direction="row">
          {settings.renamable === true && !state.editing && (
            <IconButton
              className={classes.editButton}
              title="Rename"
              data-node-function="edit-label"
              color="primary"
              onClick={(event) => {
                event.stopPropagation();
                toggleEditing();
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          )}
          {settings.visible != undefined && (
            <VisibilityToggle
              size="small"
              checked={visible}
              onChange={toggleVisibility}
              style={{ opacity: allowVisibilityToggle ? 1 : 0 }}
              disabled={!allowVisibilityToggle}
            />
          )}
          {props.settings?.error && (
            <Tooltip
              arrow
              title={
                <Typography variant="subtitle2" className={classes.errorTooltip}>
                  {props.settings.error}
                </Typography>
              }
            >
              <IconButton size="small" color="error">
                <ErrorIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {settings.actions && (
            <NodeActionsMenu actions={settings.actions} onSelectAction={handleNodeAction} />
          )}
        </Stack>
      </div>
      {state.open && fieldEditors.length > 0 && (
        <>
          <div className={classes.fieldPadding} />
          {fieldEditors}
          <div className={classes.fieldPadding} />
        </>
      )}
      {state.open && selectVisibilityFilterEnabled && hasChildren && (
        <FieldEditor
          key="visibilityFilter"
          field={{ ...SelectVisibilityFilterField, value: state.visibilityFilter }}
          path={makeStablePath(props.path, "visibilityFilter")}
          actionHandler={selectVisibilityFilter}
        />
      )}
      {state.open && childNodes}
      {indent === 1 && <Divider style={{ gridColumn: "span 2" }} />}
    </>
  );
}

export const NodeEditor = React.memo(NodeEditorComponent);
