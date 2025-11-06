// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ArrowDownIcon from "@mui/icons-material/ArrowDropDown";
import ArrowRightIcon from "@mui/icons-material/ArrowRight";
import CheckIcon from "@mui/icons-material/Check";
import EditIcon from "@mui/icons-material/Edit";
import ErrorIcon from "@mui/icons-material/Error";
import { Button, Divider, IconButton, TextField, Tooltip, Typography } from "@mui/material";
import { TFunction } from "i18next";
import * as _ from "lodash-es";
import memoizeWeak from "memoize-weak";
import { ChangeEvent, useCallback, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useImmer } from "use-immer";

import { filterMap } from "@lichtblick/den/collection";
import {
  Immutable,
  SettingsTreeAction,
  SettingsTreeField,
  SettingsTreeNode,
  SettingsTreeNodeActionItem,
} from "@lichtblick/suite";
import { HighlightedText } from "@lichtblick/suite-base/components/HighlightedText";
import { useStyles } from "@lichtblick/suite-base/components/SettingsTreeEditor/NodeEditor.style";
import {
  NodeEditorProps,
  SelectVisibilityFilterValue,
} from "@lichtblick/suite-base/components/SettingsTreeEditor/types";
import Stack from "@lichtblick/suite-base/components/Stack";
import { useAppContext } from "@lichtblick/suite-base/context/AppContext";

import { FieldEditor } from "./FieldEditor";
import { NodeActionsMenu } from "./NodeActionsMenu";
import { VisibilityToggle } from "./VisibilityToggle";
import { icons } from "./icons";
import { prepareSettingsNodes } from "./utils";

function ExpansionArrow({ expanded }: Readonly<{ expanded: boolean }>): React.JSX.Element {
  const { classes } = useStyles();

  const Component = expanded ? ArrowDownIcon : ArrowRightIcon;
  return (
    <div className={classes.iconWrapper}>
      <Component />
    </div>
  );
}

const makeStablePath = memoizeWeak((path: readonly string[], key: string) => [...path, key]);

const SelectVisibilityFilterOptions: (t: TFunction<"settingsEditor">) => {
  label: string;
  value: SelectVisibilityFilterValue;
}[] = (t) => [
  { label: t("listAll"), value: "all" },
  { label: t("listVisible"), value: "visible" },
  { label: t("listInvisible"), value: "invisible" },
];
function showVisibleFilter(child: Immutable<SettingsTreeNode>): boolean {
  // want to show children with undefined visibility
  return child.visible !== false;
}
function showInvisibleFilter(child: Immutable<SettingsTreeNode>): boolean {
  // want to show children with undefined visibility
  return child.visible !== true;
}
const getSelectVisibilityFilterField = (t: TFunction<"settingsEditor">) =>
  ({
    input: "select",
    label: t("filterList"),
    help: t("filterListHelp"),
    options: SelectVisibilityFilterOptions(t),
  }) as const;

type State = {
  editing: boolean;
  focusedPath: undefined | readonly string[];
  open: boolean;
  visibilityFilter: SelectVisibilityFilterValue;
};

function NodeEditorComponent(props: Readonly<NodeEditorProps>): React.JSX.Element {
  const { actionHandler, defaultOpen = true, filter, focusedPath, settings = {} } = props;
  const [state, setState] = useImmer<State>({
    editing: false,
    focusedPath: undefined,
    open: defaultOpen,
    visibilityFilter: "all",
  });
  const { renderSettingsStatusButton } = useAppContext();
  const { t } = useTranslation("settingsEditor");
  const { classes, cx, theme } = useStyles();

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

  const isFocused = _.isEqual(focusedPath, props.path);

  useEffect(() => {
    const isOnFocusedPath =
      focusedPath != undefined && _.isEqual(props.path, focusedPath.slice(0, props.path.length));

    if (isOnFocusedPath) {
      setState((draft) => {
        draft.open = true;
      });
    }

    if (isFocused) {
      rootRef.current?.scrollIntoView();
    }
  }, [focusedPath, isFocused, props.path, setState]);

  const { fields, children } = settings;
  const hasChildren = children != undefined && Object.keys(children).length > 0;
  const hasProperties = fields != undefined || hasChildren;

  const rootRef = useRef<HTMLDivElement>(ReactNull);

  const entries = useMemo(() => Object.entries(fields ?? {}), [fields]);

  const renderFieldEditor = useCallback(
    (key: string, field: Immutable<SettingsTreeField>) => (
      <FieldEditor
        key={key}
        field={field}
        path={makeStablePath(props.path, key)}
        actionHandler={actionHandler}
      />
    ),
    [props.path, actionHandler],
  );

  const fieldEditors = useMemo(
    () =>
      entries.filter(([, field]) => field).map(([key, field]) => renderFieldEditor(key, field!)),
    [entries, renderFieldEditor],
  );

  const filterFn = useMemo(() => {
    if (state.visibilityFilter === "visible") {
      return showVisibleFilter;
    }
    if (state.visibilityFilter === "invisible") {
      return showInvisibleFilter;
    }
    return undefined;
  }, [state.visibilityFilter]);

  const preparedNodes = useMemo(() => prepareSettingsNodes(children ?? {}), [children]);

  const filteredNodes = useMemo(() => {
    if (!filterFn) {
      return preparedNodes;
    }
    return preparedNodes.filter(([, child]) => filterFn(child));
  }, [preparedNodes, filterFn]);

  const childNodes = useMemo(() => {
    return filterMap(filteredNodes, ([key, child]) => (
      <NodeEditor
        actionHandler={actionHandler}
        defaultOpen={child.defaultExpansionState !== "collapsed"}
        filter={filter}
        focusedPath={focusedPath}
        key={key}
        settings={child}
        path={makeStablePath(props.path, key)}
      />
    ));
  }, [filteredNodes, actionHandler, filter, focusedPath, props.path]);

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

  const [inlineActions, menuActions] = useMemo(
    () =>
      _.partition(
        settings.actions,
        (action): action is SettingsTreeNodeActionItem =>
          action.type === "action" && action.display === "inline",
      ),
    [settings.actions],
  );

  const statusButton = renderSettingsStatusButton
    ? renderSettingsStatusButton(settings)
    : undefined;

  // Determine the item to render in the icon slot
  // If there's an error we render the error dot, otherwise we render the provided IconComponent
  const iconItem = useMemo(() => {
    if (props.settings?.error) {
      return (
        <Tooltip
          arrow
          title={
            <Typography variant="subtitle2" className={classes.errorTooltip}>
              {props.settings.error}
            </Typography>
          }
        >
          <ErrorIcon
            fontSize="small"
            color="error"
            style={{
              marginRight: theme.spacing(0.5),
            }}
          />
        </Tooltip>
      );
    }

    if (IconComponent) {
      return (
        <IconComponent
          fontSize="small"
          color="inherit"
          style={{
            marginRight: theme.spacing(0.5),
            opacity: 0.8,
          }}
        />
      );
    }

    return <></>;
  }, [IconComponent, classes.errorTooltip, props.settings?.error, theme]);

  return (
    <>
      <div
        className={cx(classes.nodeHeader, {
          [classes.focusedNode]: isFocused,
          [classes.nodeHeaderVisible]: visible,
        })}
        ref={rootRef}
      >
        <div
          className={cx(classes.nodeHeaderToggle, {
            [classes.nodeHeaderToggleHasProperties]: hasProperties,
            [classes.nodeHeaderToggleVisible]: visible,
          })}
          style={{
            marginLeft: theme.spacing(0.75 + 2 * indent),
          }}
          onClick={toggleOpen}
          data-testid={`settings__nodeHeaderToggle__${props.path.join("-")}`}
        >
          {hasProperties && <ExpansionArrow expanded={state.open} />}
          {iconItem}
          {state.editing ? (
            <TextField
              className={classes.editNameField}
              autoFocus
              variant="filled"
              onChange={onEditLabel}
              value={settings.label}
              onBlur={toggleEditing}
              onKeyDown={onLabelKeyDown}
              onFocus={(event) => {
                event.target.select();
              }}
              slotProps={{
                input: {
                  endAdornment: (
                    <IconButton
                      className={classes.actionButton}
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
                },
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
              <HighlightedText text={settings.label ?? t("general")} highlight={filter} />
            </Typography>
          )}
        </div>
        <Stack alignItems="center" direction="row">
          {settings.renamable === true && !state.editing && (
            <IconButton
              className={classes.actionButton}
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
          {statusButton ??
            (settings.visible != undefined && (
              <VisibilityToggle
                size="small"
                checked={visible}
                onChange={toggleVisibility}
                style={{ opacity: allowVisibilityToggle ? 1 : 0 }}
                disabled={!allowVisibilityToggle}
              />
            ))}
          {inlineActions.map((action) => {
            const Icon = action.icon ? icons[action.icon] : undefined;
            const handler = () => {
              actionHandler({
                action: "perform-node-action",
                payload: { id: action.id, path: props.path },
              });
            };
            return Icon ? (
              <IconButton
                key={action.id}
                onClick={handler}
                title={action.label}
                className={classes.actionButton}
              >
                <Icon fontSize="small" />
              </IconButton>
            ) : (
              <Button
                key={action.id}
                onClick={handler}
                size="small"
                color="inherit"
                className={classes.actionButton}
              >
                {action.label}
              </Button>
            );
          })}

          {menuActions.length > 0 && (
            <NodeActionsMenu actions={menuActions} onSelectAction={handleNodeAction} />
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
        <>
          <Stack paddingBottom={0.5} style={{ gridColumn: "span 2" }} />
          <FieldEditor
            key="visibilityFilter"
            field={{ ...getSelectVisibilityFilterField(t), value: state.visibilityFilter }}
            path={makeStablePath(props.path, "visibilityFilter")}
            actionHandler={selectVisibilityFilter}
          />
        </>
      )}
      {state.open && childNodes}
      {indent === 1 && <Divider style={{ gridColumn: "span 2" }} />}
    </>
  );
}

export const NodeEditor = React.memo(NodeEditorComponent);
