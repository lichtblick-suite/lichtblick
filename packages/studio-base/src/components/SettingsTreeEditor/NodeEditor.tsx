// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ArrowDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import CheckIcon from "@mui/icons-material/Check";
import EditIcon from "@mui/icons-material/Edit";
import ErrorIcon from "@mui/icons-material/Error";
import {
  Divider,
  IconButton,
  InputBase,
  styled as muiStyled,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import memoizeWeak from "memoize-weak";
import { ChangeEvent, useCallback } from "react";
import { DeepReadonly } from "ts-essentials";
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

const FieldPadding = muiStyled("div", { skipSx: true })(({ theme }) => ({
  gridColumn: "span 2",
  height: theme.spacing(0.5),
}));

const EditButton = muiStyled(IconButton)(({ theme }) => ({
  padding: theme.spacing(0.5),
}));

const NodeHeader = muiStyled("div", {
  shouldForwardProp: (prop) => prop !== "visible",
})<{ visible: boolean }>(({ theme, visible }) => {
  return {
    display: "flex",
    gridColumn: "span 2",
    paddingRight: theme.spacing(0.5),
    minHeight: NODE_HEADER_MIN_HEIGHT,

    "@media (pointer: fine)": {
      ".MuiCheckbox-root": {
        visibility: visible ? "hidden" : "visible",
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
  };
});

const NodeHeaderToggle = muiStyled("div", {
  shouldForwardProp: (prop) => prop !== "hasProperties" && prop !== "indent" && prop !== "visible",
})<{ hasProperties: boolean; indent: number; visible: boolean }>(
  ({ hasProperties, theme, indent, visible }) => {
    return {
      display: "grid",
      alignItems: "center",
      cursor: hasProperties ? "pointer" : "auto",
      gridTemplateColumns: "auto 1fr auto",
      marginLeft: theme.spacing(0.75 + 2 * indent),
      opacity: visible ? 1 : 0.6,
      position: "relative",
      userSelect: "none",
      width: "100%",
    };
  },
);

const IconWrapper = muiStyled("div")({
  position: "absolute",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  top: "50%",
  left: 0,
  transform: "translate(-97.5%, -50%)",
});

function ExpansionArrow({ expanded }: { expanded: boolean }): JSX.Element {
  const Component = expanded ? ArrowDownIcon : ArrowRightIcon;
  return (
    <IconWrapper>
      <Component />
    </IconWrapper>
  );
}

const makeStablePath = memoizeWeak((path: readonly string[], key: string) => [...path, key]);

function NodeEditorComponent(props: NodeEditorProps): JSX.Element {
  const { actionHandler, defaultOpen = true, filter, settings = {} } = props;
  const [state, setState] = useImmer({ open: defaultOpen, editing: false });

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

  const childNodes = prepareSettingsNodes(children ?? {}).map(([key, child]) => {
    return (
      <NodeEditor
        actionHandler={actionHandler}
        defaultOpen={child.defaultExpansionState === "collapsed" ? false : true}
        filter={filter}
        key={key}
        settings={child}
        path={makeStablePath(props.path, key)}
      />
    );
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
      <NodeHeader visible={visible}>
        <NodeHeaderToggle
          hasProperties={hasProperties}
          indent={indent}
          onClick={toggleOpen}
          visible={visible}
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
            <InputBase
              autoFocus
              fullWidth
              onChange={onEditLabel}
              value={settings.label}
              onKeyDown={onLabelKeyDown}
              onFocus={(event) => event.target.select()}
              style={{ font: "inherit" }}
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
        </NodeHeaderToggle>
        <Stack alignItems="center" direction="row">
          {settings.renamable === true && (
            <EditButton
              title="Rename"
              data-node-function="edit-label"
              color="primary"
              onClick={(event) => {
                event.stopPropagation();
                toggleEditing();
              }}
            >
              {state.editing ? <CheckIcon fontSize="small" /> : <EditIcon fontSize="small" />}
            </EditButton>
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
              title={<Typography variant="subtitle2">{props.settings.error}</Typography>}
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
      </NodeHeader>
      {state.open && fieldEditors.length > 0 && (
        <>
          <FieldPadding />
          {fieldEditors}
          <FieldPadding />
        </>
      )}
      {state.open && childNodes}
      {indent === 1 && <Divider style={{ gridColumn: "span 2" }} />}
    </>
  );
}

export const NodeEditor = React.memo(NodeEditorComponent);
