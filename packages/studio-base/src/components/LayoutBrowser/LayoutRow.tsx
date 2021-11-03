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
  IContextualMenuItem,
  ContextualMenu,
} from "@fluentui/react";
import cx from "classnames";
import { useCallback, useContext, useLayoutEffect, useState } from "react";
import { useMountedState } from "react-use";

import { useLayoutManager } from "@foxglove/studio-base/context/LayoutManagerContext";
import LayoutStorageDebuggingContext from "@foxglove/studio-base/context/LayoutStorageDebuggingContext";
import { useConfirm } from "@foxglove/studio-base/hooks/useConfirm";
import { Layout, layoutIsShared } from "@foxglove/studio-base/services/ILayoutStorage";

import { debugBorder } from "./styles";

const useStyles = makeStyles((theme) => ({
  layoutRow: {
    cursor: "pointer",
    paddingLeft: theme.spacing.m,
    paddingRight: theme.spacing.s1,
    marginBottom: 1,
    marginTop: 1,

    ":hover": {
      background: theme.semanticColors.menuItemBackgroundHovered,
    },
    ":hover > .ms-Button--hasMenu": {
      opacity: 1,
    },
  },

  layoutRowSelected: {
    background: theme.semanticColors.menuItemBackgroundHovered,

    ":hover": {
      background: theme.semanticColors.menuItemBackgroundHovered,
    },
  },

  // Pin the "hover" style when the right-click menu is open
  layoutRowWithOpenMenu: {
    background: theme.semanticColors.menuItemBackgroundHovered,

    "& .ms-Button--hasMenu": {
      opacity: 1,
    },
  },

  layoutRowSelectedWithOpenMenu: {
    background: theme.semanticColors.menuItemBackgroundHovered,

    "& .ms-Button--hasMenu": {
      opacity: 1,
    },
  },

  layoutName: {
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    overflow: "hidden",
    lineHeight: theme.spacing.l2, // avoid descenders being cut off
    userSelect: "none",
  },
  layoutNameSelected: {
    color: theme.palette.themePrimary,
  },

  menuButton: {
    opacity: 0,

    "&.is-expanded, :focus": {
      opacity: 1,
    },
  },
  menuButtonModified: {
    opacity: 1,
  },
}));

export default function LayoutRow({
  layout,
  selected,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onShare,
  onExport,
  onOverwrite,
  onRevert,
  onMakePersonalCopy,
}: {
  layout: Layout;
  selected: boolean;
  onSelect: (item: Layout, params?: { selectedViaClick?: boolean }) => void;
  onRename: (item: Layout, newName: string) => void;
  onDuplicate: (item: Layout) => void;
  onDelete: (item: Layout) => void;
  onShare: (item: Layout) => void;
  onExport: (item: Layout) => void;
  onOverwrite: (item: Layout) => void;
  onRevert: (item: Layout) => void;
  onMakePersonalCopy: (item: Layout) => void;
}): JSX.Element {
  const styles = useStyles();
  const theme = useTheme();
  const isMounted = useMountedState();
  const confirm = useConfirm();

  const [editingName, setEditingName] = useState(false);
  const [nameFieldValue, setNameFieldValue] = useState("");
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const onMenuOpened = useCallback(() => setMenuOpen(true), []);
  const onMenuDismissed = useCallback(() => setMenuOpen(false), []);

  const layoutDebug = useContext(LayoutStorageDebuggingContext);
  const layoutManager = useLayoutManager();
  const deletedOnServer = layout.syncInfo?.status === "remotely-deleted";
  const hasModifications = layout.working != undefined;

  const [isOnline, setIsOnline] = useState(layoutManager.isOnline);
  useLayoutEffect(() => {
    const onlineListener = () => setIsOnline(layoutManager.isOnline);
    onlineListener();
    layoutManager.on("onlinechange", onlineListener);
    return () => {
      layoutManager.off("onlinechange", onlineListener);
    };
  }, [layoutManager]);

  const overwriteAction = useCallback(() => {
    onOverwrite(layout);
  }, [layout, onOverwrite]);
  const revertAction = useCallback(() => {
    onRevert(layout);
  }, [layout, onRevert]);
  const makePersonalCopyAction = useCallback(() => {
    onMakePersonalCopy(layout);
  }, [layout, onMakePersonalCopy]);

  const renameAction = useCallback(() => {
    setEditingName(true);
    setNameFieldValue(layout.name);
  }, [layout]);

  const onClick = useCallback(() => {
    if (!selected) {
      onSelect(layout, { selectedViaClick: true });
    }
  }, [layout, onSelect, selected]);

  const duplicateAction = useCallback(() => onDuplicate(layout), [layout, onDuplicate]);

  const shareAction = useCallback(() => onShare(layout), [layout, onShare]);
  const exportAction = useCallback(() => onExport(layout), [layout, onExport]);

  const onSubmit = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      if (!editingName) {
        return;
      }
      const newName = nameFieldValue;
      if (newName && newName !== layout.name) {
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

  const onBlur = useCallback(
    (event: React.FocusEvent) => {
      onSubmit(event);
    },
    [onSubmit],
  );

  const onTextFieldMount = useCallback((field: ITextField | ReactNull) => {
    // When focusing via right-click we need an extra tick to be able to successfully focus the field
    setTimeout(() => {
      field?.select();
    }, 0);
  }, []);

  const confirmDelete = useCallback(() => {
    void confirm({
      title: `Delete “${layout.name}”?`,
      prompt: `${
        layoutIsShared(layout) ? "Team members will no longer be able to access this layout." : ""
      } This action cannot be undone.`,
      ok: "Delete",
      variant: "danger",
    }).then((response) => {
      if (response === "ok" && isMounted()) {
        onDelete(layout);
      }
    });
  }, [confirm, isMounted, layout, onDelete]);

  const menuItems: (boolean | IContextualMenuItem)[] = [
    {
      key: "rename",
      text: "Rename",
      iconProps: { iconName: "Rename" },
      onClick: renameAction,
      ["data-test"]: "rename-layout",
      disabled: layoutIsShared(layout) && !isOnline,
      secondaryText: layoutIsShared(layout) && !isOnline ? "Offline" : undefined,
    },
    // For shared layouts, duplicate first requires saving or discarding changes
    !(layoutIsShared(layout) && hasModifications) && {
      key: "duplicate",
      text:
        layoutManager.supportsSharing && layoutIsShared(layout)
          ? "Make a personal copy"
          : "Duplicate",
      iconProps: { iconName: "Copy" },
      onClick: duplicateAction,
      ["data-test"]: "duplicate-layout",
    },
    layoutManager.supportsSharing &&
      !layoutIsShared(layout) && {
        key: "share",
        text: "Share with team…",
        iconProps: { iconName: "Share" },
        onClick: shareAction,
        disabled: !isOnline,
        secondaryText: !isOnline ? "Offline" : undefined,
      },
    {
      key: "export",
      text: "Export…",
      iconProps: { iconName: "DownloadDocument" },
      onClick: exportAction,
    },
    { key: "divider_1", itemType: ContextualMenuItemType.Divider },
    {
      key: "delete",
      text: "Delete",
      iconProps: {
        iconName: "Delete",
        styles: { root: { color: theme.semanticColors.errorText } },
      },
      onClick: confirmDelete,
      ["data-test"]: "delete-layout",
    },
  ];

  if (hasModifications) {
    const sectionItems: IContextualMenuItem[] = [
      {
        key: "overwrite",
        text: "Save",
        iconProps: { iconName: "Upload" },
        onClick: overwriteAction,
        disabled: deletedOnServer || (layoutIsShared(layout) && !isOnline),
        secondaryText: layoutIsShared(layout) && !isOnline ? "Offline" : undefined,
      },
      {
        key: "revert",
        text: "Revert",
        iconProps: { iconName: "Undo" },
        onClick: revertAction,
        disabled: deletedOnServer,
      },
    ];
    if (layoutIsShared(layout)) {
      sectionItems.push({
        key: "copy_to_personal",
        text: "Make a personal copy",
        iconProps: { iconName: "DependencyAdd" },
        onClick: makePersonalCopyAction,
      });
    }
    menuItems.unshift({
      key: "changes",
      itemType: ContextualMenuItemType.Section,
      sectionProps: {
        bottomDivider: true,
        title: deletedOnServer
          ? "Someone else has deleted this layout."
          : "This layout has been modified since it was last saved.",
        items: sectionItems,
      },
    });
  }

  if (layoutDebug) {
    menuItems.push(
      { key: "debug_divider", itemType: ContextualMenuItemType.Divider },
      {
        key: "debug_id",
        text: layout.id,
        disabled: true,
        itemProps: {
          styles: {
            root: { ...debugBorder, borderRight: "none", borderTop: "none", borderBottom: "none" },
          },
        },
      },
      {
        key: "debug_updated_at",
        text: `Saved at: ${layout.working?.savedAt ?? layout.baseline.savedAt}`,
        disabled: true,
        itemProps: {
          styles: {
            root: { ...debugBorder, borderRight: "none", borderTop: "none", borderBottom: "none" },
          },
        },
      },
      {
        key: "debug_sync_status",
        text: `Sync status: ${layout.syncInfo?.status}`,
        disabled: true,
        itemProps: {
          styles: {
            root: { ...debugBorder, borderRight: "none", borderTop: "none", borderBottom: "none" },
          },
        },
      },
      {
        key: "debug_edit",
        text: "Inject edit",
        iconProps: { iconName: "TestBeakerSolid" },
        onClick: () => void layoutDebug.injectEdit(layout.id),
        itemProps: {
          styles: {
            root: { ...debugBorder, borderRight: "none", borderTop: "none", borderBottom: "none" },
          },
        },
      },
      {
        key: "debug_rename",
        text: "Inject rename",
        iconProps: { iconName: "TestBeakerSolid" },
        onClick: () => void layoutDebug.injectRename(layout.id),
        itemProps: {
          styles: {
            root: { ...debugBorder, borderRight: "none", borderTop: "none", borderBottom: "none" },
          },
        },
      },
      {
        key: "debug_delete",
        text: "Inject delete",
        iconProps: { iconName: "TestBeakerSolid" },
        onClick: () => void layoutDebug.injectDelete(layout.id),
        itemProps: {
          styles: {
            root: { ...debugBorder, borderRight: "none", borderTop: "none", borderBottom: "none" },
          },
        },
      },
    );
  }

  const filteredItems = menuItems.filter(
    (item): item is IContextualMenuItem => typeof item === "object",
  );

  const [contextMenuEvent, setContextMenuEvent] = useState<MouseEvent | undefined>();

  return (
    <Stack
      as="form"
      horizontal
      verticalAlign="center"
      className={cx(styles.layoutRow, {
        [styles.layoutRowSelected]: selected,
        [styles.layoutRowWithOpenMenu]: contextMenuEvent != undefined || menuOpen,
        [styles.layoutRowSelectedWithOpenMenu]:
          (selected && contextMenuEvent != undefined) || menuOpen,
      })}
      onClick={editingName ? undefined : onClick}
      onSubmit={onSubmit}
      onContextMenu={(event) => {
        event.preventDefault();
        setContextMenuEvent(event.nativeEvent);
      }}
    >
      {contextMenuEvent && (
        <ContextualMenu
          target={contextMenuEvent}
          items={filteredItems}
          onDismiss={() => setContextMenuEvent(undefined)}
        />
      )}
      {editingName ? (
        <TextField
          componentRef={onTextFieldMount}
          value={nameFieldValue}
          onChange={(_event, newValue) => newValue != undefined && setNameFieldValue(newValue)}
          onKeyDown={onTextFieldKeyDown}
          onBlur={onBlur}
          styles={{
            root: {
              flex: 1,
            },
            fieldGroup: {
              marginLeft: `-${theme.spacing.s1}`,
            },
          }}
        />
      ) : (
        <Stack.Item
          grow
          title={layout.name}
          className={cx(styles.layoutName, { [styles.layoutNameSelected]: selected })}
        >
          {layout.name}
        </Stack.Item>
      )}

      {!editingName && (
        <IconButton
          ariaLabel="Layout actions"
          className={cx(styles.menuButton, {
            [styles.menuButtonModified]: hasModifications,
          })}
          data-test="layout-actions"
          iconProps={{
            iconName: deletedOnServer ? "Error" : hasModifications ? "LocationDot" : "More",
            styles: {
              root: {
                color: deletedOnServer ? theme.semanticColors.errorIcon : undefined,
              },
            },
          }}
          onRenderMenuIcon={() => ReactNull}
          menuProps={{
            items: filteredItems,
            onMenuOpened,
            onMenuDismissed,
            styles: {
              header: {
                height: 30,

                "& i": {
                  display: "none",
                },
              },
            },
          }}
          styles={{
            icon: {
              height: 20,
            },
            root: {
              marginRight: `-${theme.spacing.s1}`,
              borderRadius: "none",
            },
            rootHovered: { background: "transparent" },
          }}
        />
      )}
    </Stack>
  );
}
