// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  ContextualMenuItemType,
  IconButton,
  TextField,
  ITextField,
  makeStyles,
  Stack,
  useTheme,
} from "@fluentui/react";
import cx from "classnames";
import { useCallback, useState } from "react";

import useConfirm from "@foxglove/studio-base/components/useConfirm";
import { nonEmptyOrUndefined } from "@foxglove/studio-base/util/emptyOrUndefined";

import { LayoutItem } from "./types";

const useStyles = makeStyles((theme) => ({
  layoutRow: {
    cursor: "pointer",
    paddingLeft: theme.spacing.m,
    paddingRight: theme.spacing.s1,
    ":hover": {
      background: theme.semanticColors.listItemBackgroundHovered,
    },
  },

  layoutRowSelected: {
    background: theme.semanticColors.listItemBackgroundChecked,
    ":hover": {
      background: theme.semanticColors.listItemBackgroundCheckedHovered,
    },
  },

  layoutName: {
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    overflow: "hidden",
    lineHeight: theme.spacing.l2, // avoid descenders being cut off
  },
}));

export default function LayoutRow<T extends LayoutItem>({
  layout,
  selected,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onExport,
}: {
  layout: T;
  selected: boolean;
  onSelect: (item: T) => void;
  onRename: (item: T, newName: string) => void;
  onDuplicate: (item: T) => void;
  onDelete: (item: T) => void;
  onExport: (item: T) => void;
}): JSX.Element {
  const styles = useStyles();
  const theme = useTheme();

  const [editingName, setEditingName] = useState(false);
  const [nameFieldValue, setNameFieldValue] = useState("");

  const selectAction = useCallback(() => onSelect(layout), [layout, onSelect]);

  const renameAction = useCallback(() => {
    setEditingName(true);
    setNameFieldValue(layout.name);
  }, [layout]);

  const duplicateAction = useCallback(() => onDuplicate(layout), [layout, onDuplicate]);

  const exportAction = useCallback(() => onExport(layout), [layout, onExport]);

  const onSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (!editingName) {
        return;
      }
      const newName = nonEmptyOrUndefined(nameFieldValue);
      if (newName != undefined) {
        onRename(layout, newName);
      }
      setEditingName(false);
    },
    [editingName, layout, nameFieldValue, onRename],
  );

  const onTextFieldKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      setEditingName(false);
    }
  }, []);

  const onTextFieldMount = useCallback((field: ITextField | ReactNull) => {
    field?.select();
  }, []);

  const confirmDelete = useConfirm({
    title: `Delete “${layout.name}”?`,
    action: (ok) => ok && onDelete(layout),
    ok: "Delete",
    confirmStyle: "danger",
  });

  return (
    <Stack
      as="form"
      horizontal
      verticalAlign="center"
      className={cx(styles.layoutRow, { [styles.layoutRowSelected]: selected })}
      onClick={editingName ? undefined : selectAction}
      onSubmit={onSubmit}
    >
      {confirmDelete.modal}
      <Stack.Item grow className={styles.layoutName} title={layout.name}>
        {editingName ? (
          <TextField
            componentRef={onTextFieldMount}
            value={nameFieldValue}
            onChange={(_event, newValue) => newValue != undefined && setNameFieldValue(newValue)}
            onKeyDown={onTextFieldKeyDown}
          />
        ) : (
          layout.name
        )}
      </Stack.Item>

      {editingName ? (
        <>
          <IconButton
            type="submit"
            iconProps={{ iconName: "CheckMark" }}
            ariaLabel="Rename"
            data-test="commit-rename"
          />
          <IconButton
            iconProps={{ iconName: "Cancel" }}
            onClick={() => setEditingName(false)}
            ariaLabel="Cancel"
            data-test="cancel-rename"
          />
        </>
      ) : (
        <IconButton
          ariaLabel="Layout actions"
          data={{ text: "x" }}
          data-test="layout-actions"
          iconProps={{
            iconName: "More",
            styles: { root: { "& span": { verticalAlign: "baseline" } } },
          }}
          onRenderMenuIcon={() => ReactNull}
          menuProps={{
            items: [
              {
                key: "rename",
                text: "Rename",
                iconProps: { iconName: "Rename" },
                onClick: renameAction,
                ["data-test"]: "rename-layout",
              },
              {
                key: "duplicate",
                text: "Duplicate",
                iconProps: { iconName: "Copy" },
                onClick: duplicateAction,
                ["data-test"]: "duplicate-layout",
              },
              {
                key: "export",
                text: "Export",
                iconProps: { iconName: "Share" },
                onClick: exportAction,
              },
              { key: "divider_1", itemType: ContextualMenuItemType.Divider },
              {
                key: "delete",
                text: "Delete…",
                iconProps: {
                  iconName: "Delete",
                  styles: { root: { color: theme.semanticColors.errorText } },
                },
                onClick: confirmDelete.open,
                ["data-test"]: "delete-layout",
              },
            ],
          }}
        />
      )}
    </Stack>
  );
}
