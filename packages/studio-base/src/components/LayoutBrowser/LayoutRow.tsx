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
import { useCallback, useContext, useState } from "react";
import { useMountedState } from "react-use";

import { useLayoutManager } from "@foxglove/studio-base/context/LayoutManagerContext";
import LayoutStorageDebuggingContext from "@foxglove/studio-base/context/LayoutStorageDebuggingContext";
import { useConfirm } from "@foxglove/studio-base/hooks/useConfirm";
import { Layout } from "@foxglove/studio-base/services/ILayoutStorage";

import { debugBorder } from "./styles";

const useStyles = makeStyles((theme) => ({
  layoutRow: {
    cursor: "pointer",
    paddingLeft: theme.spacing.m,
    paddingRight: theme.spacing.s1,
    borderBottom: `1px solid ${theme.semanticColors.bodyBackground}`,
    borderTop: `1px solid ${theme.semanticColors.bodyBackground}`,

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
    fontWeight: 600,
    color: theme.palette.themePrimary,
  },

  menuButton: {
    opacity: 0,

    "&.is-expanded, :focus": {
      opacity: 1,
    },
  },
  menuButtonWorking: {
    opacity: 1,
  },
}));

export default function LayoutRow({
  layout,
  selected,
  // onSave,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onShare,
  onExport,
  // onResolveConflict,
  onOverwrite,
  onRevert,
}: {
  layout: Layout;
  selected: boolean;
  onSelect: (item: Layout, selectedViaClick?: boolean) => void;
  onRename: (item: Layout, newName: string) => void;
  onDuplicate: (item: Layout) => void;
  onDelete: (item: Layout) => void;
  onShare: (item: Layout) => void;
  onExport: (item: Layout) => void;
  onOverwrite: (item: Layout) => void;
  onRevert: (item: Layout) => void;
}): JSX.Element {
  const styles = useStyles();
  const theme = useTheme();
  const isMounted = useMountedState();

  const [editingName, setEditingName] = useState(false);
  const [nameFieldValue, setNameFieldValue] = useState("");
  const [hovered, setHovered] = useState<boolean>(false);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  const onMouseEnter = useCallback(() => setHovered(true), []);
  const onMouseLeave = useCallback(() => setHovered(false), []);

  const onMenuOpened = useCallback(() => setMenuOpen(true), []);
  const onMenuDismissed = useCallback(() => setMenuOpen(false), []);

  const layoutStorage = useLayoutManager();

  // const saveAction = useCallback(() => {
  //   onSave(layout);
  // }, [layout, onSave]);

  const overwriteAction = useCallback(() => {
    onOverwrite(layout);
  }, [layout, onOverwrite]);
  const revertAction = useCallback(() => {
    onRevert(layout);
  }, [layout, onRevert]);

  const renameAction = useCallback(() => {
    setEditingName(true);
    setNameFieldValue(layout.name);
  }, [layout]);

  const onClick = useCallback(() => {
    if (selected) {
      renameAction();
    } else {
      onSelect(layout, true);
    }
  }, [layout, onSelect, renameAction, selected]);

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

  const confirm = useConfirm();

  const layoutDebug = useContext(LayoutStorageDebuggingContext);

  const confirmDelete = useCallback(() => {
    void confirm({
      title: `Delete “${layout.name}”?`,
      ok: "Delete",
      variant: "danger",
    }).then((response) => {
      if (response === "ok" && isMounted()) {
        onDelete(layout);
      }
    });
  }, [confirm, isMounted, layout, onDelete]);

  // const confirmRevertLocal = useCallback(() => {
  //   void confirm({
  //     title: `Revert “${layout.name}” to the latest version?`,
  //     prompt: "Changes made on this device will be lost.",
  //     ok: "Revert",
  //     variant: "danger",
  //   }).then((response) => {
  //     if (response === "ok" && isMounted()) {
  //       onResolveConflict(layout, "revert-local");
  //     }
  //   });
  // }, [confirm, isMounted, layout, onResolveConflict]);

  // const confirmDeleteLocal = useCallback(() => {
  //   void confirm({
  //     title: `Delete “${layout.name}”?`,
  //     prompt: "Changes made on this device will be lost.",
  //     ok: "Delete",
  //     variant: "danger",
  //   }).then((response) => {
  //     if (response === "ok" && isMounted()) {
  //       onResolveConflict(layout, "delete-local");
  //     }
  //   });
  // }, [confirm, isMounted, layout, onResolveConflict]);

  // const confirmOverwriteRemote = useCallback(() => {
  //   void confirm({
  //     title: `Overwrite “${layout.name}” with local changes?`,
  //     prompt: "Changes made by others will be lost.",
  //     ok: "Overwrite",
  //     variant: "danger",
  //   }).then((response) => {
  //     if (response === "ok" && isMounted()) {
  //       onResolveConflict(layout, "overwrite-remote");
  //     }
  //   });
  // }, [confirm, isMounted, layout, onResolveConflict]);

  // const confirmDeleteRemote = useCallback(() => {
  //   void confirm({
  //     title: `Delete “${layout.name}”?`,
  //     prompt: "Changes made by others will be lost.",
  //     ok: "Delete",
  //     variant: "danger",
  //   }).then((response) => {
  //     if (response === "ok" && isMounted()) {
  //       onResolveConflict(layout, "delete-remote");
  //     }
  //   });
  // }, [confirm, isMounted, layout, onResolveConflict]);

  const menuItems: (boolean | IContextualMenuItem)[] = [
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
    layoutStorage.supportsSharing &&
      layout.permission === "creator_write" && {
        key: "share",
        text: "Share",
        iconProps: { iconName: "Share" },
        onClick: shareAction,
      },
    {
      key: "export",
      text: "Export",
      iconProps: { iconName: "DownloadDocument" },
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
      onClick: confirmDelete,
      ["data-test"]: "delete-layout",
    },
  ];

  // if (layoutStorage.supportsSyncing) {
  //   if (layout.conflict != undefined) {
  //     let conflictItems: IContextualMenuItem[];
  //     switch (layout.conflict) {
  //       case "local-delete-remote-update":
  //         conflictItems = [
  //           {
  //             key: "revert-local",
  //             text: "Revert to latest version",
  //             iconProps: { iconName: "RemoveFromTrash" },
  //             onClick: confirmRevertLocal,
  //           },
  //           {
  //             key: "delete-remote",
  //             text: "Delete for everyone",
  //             iconProps: { iconName: "Delete" },
  //             styles: { root: { color: theme.semanticColors.errorText } },
  //             onClick: confirmDeleteRemote,
  //           },
  //         ];
  //         break;
  //       case "local-update-remote-delete":
  //         conflictItems = [
  //           {
  //             key: "overwrite-remote",
  //             text: "Use my version instead",
  //             iconProps: { iconName: "Upload" },
  //             onClick: confirmOverwriteRemote,
  //           },
  //           {
  //             key: "delete-local",
  //             text: "Delete my version",
  //             iconProps: { iconName: "Delete" },
  //             styles: { root: { color: theme.semanticColors.errorText } },
  //             onClick: confirmDeleteLocal,
  //           },
  //         ];
  //         break;
  //       case "both-update":
  //         conflictItems = [
  //           {
  //             key: "overwrite-remote",
  //             text: "Use my version instead",
  //             iconProps: { iconName: "Upload" },
  //             onClick: confirmOverwriteRemote,
  //           },
  //           {
  //             key: "revert-local",
  //             text: "Revert to latest version",
  //             iconProps: { iconName: "Download" },
  //             styles: { root: { color: theme.semanticColors.errorText } },
  //             onClick: confirmRevertLocal,
  //           },
  //         ];
  //         break;
  //       case "name-collision":
  //         // Only course of action is renaming the layout
  //         conflictItems = [];
  //         break;
  //     }

  //     menuItems.unshift({
  //       key: "conflicts",
  //       itemType: ContextualMenuItemType.Section,
  //       sectionProps: {
  //         bottomDivider: true,
  //         title: conflictTypeToString(layout.conflict),
  //         items: conflictItems,
  //       },
  //     });
  //   } else {
  //     menuItems.unshift({
  //       key: "sync",
  //       text: layout.isModified ? "Sync changes" : "No unsynced changes",
  //       iconProps: { iconName: "Upload" },
  //       onClick: saveAction,
  //       disabled: !layout.isModified,
  //     });
  //   }
  // }

  if (layout.working != undefined) {
    menuItems.unshift({
      key: "changes",
      itemType: ContextualMenuItemType.Section,
      sectionProps: {
        bottomDivider: true,
        title: "This layout has changed",
        items: [
          {
            key: "overwrite",
            text: "Save changes",
            iconProps: { iconName: "Upload" },
            onClick: overwriteAction,
          },
          {
            key: "revert",
            text: "Revert to last saved version",
            iconProps: { iconName: "Undo" },
            onClick: revertAction,
          },
        ],
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
        text: `Updated at: ${layout.working?.updatedAt ?? layout.baseline.updatedAt}`,
        disabled: true,
        itemProps: {
          styles: {
            root: { ...debugBorder, borderRight: "none", borderTop: "none", borderBottom: "none" },
          },
        },
      },
    );
  }
  if (layoutDebug?.injectEdit) {
    menuItems.push({
      key: "debug_edit",
      text: "Inject edit",
      iconProps: { iconName: "TestBeakerSolid" },
      onClick: () => void layoutDebug.injectEdit?.(layout.id),
      itemProps: {
        styles: {
          root: { ...debugBorder, borderRight: "none", borderTop: "none", borderBottom: "none" },
        },
      },
    });
  }
  if (layoutDebug?.injectRename) {
    menuItems.push({
      key: "debug_rename",
      text: "Inject rename",
      iconProps: { iconName: "TestBeakerSolid" },
      onClick: () => void layoutDebug.injectRename?.(layout.id),
      itemProps: {
        styles: {
          root: { ...debugBorder, borderRight: "none", borderTop: "none", borderBottom: "none" },
        },
      },
    });
  }
  if (layoutDebug?.injectDelete) {
    menuItems.push({
      key: "debug_delete",
      text: "Inject delete",
      iconProps: { iconName: "TestBeakerSolid" },
      onClick: () => void layoutDebug.injectDelete?.(layout.id),
      itemProps: {
        styles: {
          root: { ...debugBorder, borderRight: "none", borderTop: "none", borderBottom: "none" },
        },
      },
    });
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
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
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
            [styles.menuButtonWorking]: layout.working != undefined,
          })}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
          data-test="layout-actions"
          iconProps={{
            iconName: menuOpen || hovered || layout.working == undefined ? "More" : "LocationDot",
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
