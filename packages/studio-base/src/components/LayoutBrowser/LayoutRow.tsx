// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ErrorIcon from "@mui/icons-material/Error";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Menu,
  MenuItem,
  SvgIcon,
  Divider,
  Typography,
  TextField,
  styled as muiStyled,
} from "@mui/material";
import {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  MouseEvent,
  useEffect,
  useRef,
} from "react";
import { useMountedState } from "react-use";

import { useLayoutManager } from "@foxglove/studio-base/context/LayoutManagerContext";
import LayoutStorageDebuggingContext from "@foxglove/studio-base/context/LayoutStorageDebuggingContext";
import { useConfirm } from "@foxglove/studio-base/hooks/useConfirm";
import { Layout, layoutIsShared } from "@foxglove/studio-base/services/ILayoutStorage";

const StyledListItem = muiStyled(ListItem, {
  shouldForwardProp: (prop) =>
    prop !== "hasModifications" && prop !== "deletedOnServer" && prop !== "editingName",
})<{ editingName: boolean; hasModifications: boolean; deletedOnServer: boolean }>(
  ({ editingName, hasModifications, deletedOnServer, theme }) => ({
    ".MuiListItemSecondaryAction-root": {
      right: theme.spacing(0.25),
    },
    ".MuiListItemButton-root": {
      maxWidth: "100%",
    },
    "@media (pointer: fine)": {
      ".MuiListItemButton-root": {
        paddingRight: theme.spacing(4.5),
      },
      ".MuiListItemSecondaryAction-root": {
        visibility: !hasModifications && !deletedOnServer && "hidden",
      },
      "&:hover .MuiListItemSecondaryAction-root": {
        visibility: "visible",
      },
    },
    ...(editingName && {
      ".MuiListItemButton-root": {
        paddingTop: theme.spacing(0.5),
        paddingBottom: theme.spacing(0.5),
        paddingLeft: theme.spacing(1),
      },
      ".MuiListItemText-root": {
        margin: 0,
      },
    }),
  }),
);

const StyledMenuItem = muiStyled(MenuItem, {
  shouldForwardProp: (prop) => prop !== "debug",
})<{ debug?: boolean }>(({ theme, debug = false }) => ({
  position: "relative",

  ...(debug && {
    "&:before": {
      content: "''",
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      backgroundColor: theme.palette.warning.main,
      backgroundImage: `repeating-linear-gradient(${[
        "-35deg",
        "transparent",
        "transparent 6px",
        `${theme.palette.common.black} 6px`,
        `${theme.palette.common.black} 12px`,
      ].join(",")})`,
    },
  }),
}));

export type LayoutActionMenuItem =
  | {
      type: "item";
      text: string;
      secondaryText?: string;
      key: string;
      onClick?: (event: React.MouseEvent<HTMLLIElement>) => void;
      disabled?: boolean;
      debug?: boolean;
      "data-testid"?: string;
    }
  | {
      type: "divider";
      key: string;
      debug?: boolean;
    }
  | {
      type: "header";
      key: string;
      text: string;
      debug?: boolean;
    };

export default React.memo(function LayoutRow({
  layout,
  anySelectedModifiedLayouts,
  multiSelectedIds,
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
  anySelectedModifiedLayouts: boolean;
  multiSelectedIds: readonly string[];
  selected: boolean;
  onSelect: (item: Layout, params?: { selectedViaClick?: boolean; event?: MouseEvent }) => void;
  onRename: (item: Layout, newName: string) => void;
  onDuplicate: (item: Layout) => void;
  onDelete: (item: Layout) => void;
  onShare: (item: Layout) => void;
  onExport: (item: Layout) => void;
  onOverwrite: (item: Layout) => void;
  onRevert: (item: Layout) => void;
  onMakePersonalCopy: (item: Layout) => void;
}): JSX.Element {
  const isMounted = useMountedState();
  const confirm = useConfirm();
  const layoutDebug = useContext(LayoutStorageDebuggingContext);
  const layoutManager = useLayoutManager();

  const [editingName, setEditingName] = useState(false);
  const [nameFieldValue, setNameFieldValue] = useState("");
  const [isOnline, setIsOnline] = useState(layoutManager.isOnline);
  const [contextMenuTarget, setContextMenuTarget] = useState<
    | { type: "position"; mouseX: number; mouseY: number; element?: undefined }
    | { type: "element"; element: Element }
    | undefined
  >(undefined);

  const deletedOnServer = layout.syncInfo?.status === "remotely-deleted";
  const hasModifications = layout.working != undefined;
  const multiSelection = multiSelectedIds.length > 1;

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

  const confirmRevert = useCallback(async () => {
    const response = await confirm({
      title: multiSelection ? `Revert layouts` : `Revert “${layout.name}”?`,
      prompt: "Your changes will be permantly discarded. This cannot be undone.",
      ok: "Discard changes",
      variant: "danger",
    });
    if (response !== "ok") {
      return;
    }

    onRevert(layout);
  }, [confirm, layout, multiSelection, onRevert]);

  const makePersonalCopyAction = useCallback(() => {
    onMakePersonalCopy(layout);
  }, [layout, onMakePersonalCopy]);

  const renameAction = useCallback(() => {
    setNameFieldValue(layout.name);
    setEditingName(true);
  }, [layout]);

  const onClick = useCallback(
    (event: MouseEvent) => {
      onSelect(layout, { selectedViaClick: true, event });
    },
    [layout, onSelect],
  );

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

  const nameInputRef = useRef<HTMLInputElement>(ReactNull);

  const confirmDelete = useCallback(() => {
    const layoutWarning =
      !multiSelection && layoutIsShared(layout)
        ? "Organization members will no longer be able to access this layout. "
        : "";
    const prompt = `${layoutWarning}This action cannot be undone.`;
    const title = multiSelection ? "Delete selected layouts?" : `Delete “${layout.name}”?`;
    void confirm({
      title,
      prompt,
      ok: "Delete",
      variant: "danger",
    }).then((response) => {
      if (response === "ok" && isMounted()) {
        onDelete(layout);
      }
    });
  }, [confirm, isMounted, layout, multiSelection, onDelete]);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenuTarget((target) =>
      target == undefined
        ? { type: "position", mouseX: event.clientX, mouseY: event.clientY }
        : undefined,
    );
  }, []);

  const handleMenuButtonClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenuTarget((target) =>
      target == undefined ? { type: "element", element: event.currentTarget } : undefined,
    );
  }, []);

  const handleClose = useCallback(() => {
    setContextMenuTarget(undefined);
  }, []);

  const menuItems: (boolean | LayoutActionMenuItem)[] = [
    {
      type: "item",
      key: "rename",
      text: "Rename",
      onClick: renameAction,
      "data-testid": "rename-layout",
      disabled: (layoutIsShared(layout) && !isOnline) || multiSelection,
      secondaryText: layoutIsShared(layout) && !isOnline ? "Offline" : undefined,
    },
    // For shared layouts, duplicate first requires saving or discarding changes
    !(layoutIsShared(layout) && hasModifications) && {
      type: "item",
      key: "duplicate",
      text:
        layoutManager.supportsSharing && layoutIsShared(layout)
          ? "Make a personal copy"
          : "Duplicate",
      onClick: duplicateAction,
      "data-testid": "duplicate-layout",
    },
    layoutManager.supportsSharing &&
      !layoutIsShared(layout) && {
        type: "item",
        key: "share",
        text: "Share with team…",
        onClick: shareAction,
        disabled: !isOnline || multiSelection,
        secondaryText: !isOnline ? "Offline" : undefined,
      },
    {
      type: "item",
      key: "export",
      text: "Export…",
      disabled: multiSelection,
      onClick: exportAction,
    },
    { key: "divider_1", type: "divider" },
    {
      type: "item",
      key: "delete",
      text: "Delete",
      onClick: confirmDelete,
      "data-testid": "delete-layout",
    },
  ];

  if (hasModifications || anySelectedModifiedLayouts) {
    const sectionItems: LayoutActionMenuItem[] = [
      {
        type: "item",
        key: "overwrite",
        text: "Save changes",
        onClick: overwriteAction,
        disabled: deletedOnServer || (layoutIsShared(layout) && !isOnline),
        secondaryText: layoutIsShared(layout) && !isOnline ? "Offline" : undefined,
      },
      {
        type: "item",
        key: "revert",
        text: "Revert",
        onClick: confirmRevert,
        disabled: deletedOnServer,
      },
    ];
    if (layoutIsShared(layout)) {
      sectionItems.push({
        type: "item",
        key: "copy_to_personal",
        text: "Make a personal copy",
        disabled: multiSelection,
        onClick: makePersonalCopyAction,
      });
    }

    const unsavedChangesMessage = anySelectedModifiedLayouts
      ? "These layouts have unsaved changes"
      : "This layout has unsaved changes";

    menuItems.unshift(
      {
        key: "changes",
        type: "header",
        text: deletedOnServer ? "Someone else has deleted this layout" : unsavedChangesMessage,
      },
      ...sectionItems,
      { key: "changes_divider", type: "divider" },
    );
  }

  if (layoutDebug) {
    menuItems.push(
      { key: "debug_divider", type: "divider" },
      {
        type: "item",
        key: "debug_id",
        text: layout.id,
        disabled: true,
        debug: true,
      },
      {
        type: "item",
        key: "debug_updated_at",
        text: `Saved at: ${layout.working?.savedAt ?? layout.baseline.savedAt}`,
        disabled: true,
        debug: true,
      },
      {
        type: "item",
        key: "debug_sync_status",
        text: `Sync status: ${layout.syncInfo?.status}`,
        disabled: true,
        debug: true,
      },
      {
        type: "item",
        key: "debug_edit",
        text: "Inject edit",
        onClick: () => void layoutDebug.injectEdit(layout.id),
        debug: true,
      },
      {
        type: "item",
        key: "debug_rename",
        text: "Inject rename",
        onClick: () => void layoutDebug.injectRename(layout.id),
        debug: true,
      },
      {
        type: "item",
        key: "debug_delete",
        text: "Inject delete",
        onClick: () => void layoutDebug.injectDelete(layout.id),
        debug: true,
      },
    );
  }

  const filteredItems = menuItems.filter(
    (item): item is LayoutActionMenuItem => typeof item === "object",
  );

  const actionIcon = useMemo(
    () =>
      deletedOnServer ? (
        <ErrorIcon fontSize="small" color="error" />
      ) : hasModifications ? (
        <SvgIcon fontSize="small" color="primary">
          <circle cx={12} cy={12} r={4} />
        </SvgIcon>
      ) : (
        <MoreVertIcon fontSize="small" />
      ),
    [deletedOnServer, hasModifications],
  );

  useEffect(() => {
    if (editingName) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [editingName]);

  return (
    <StyledListItem
      editingName={editingName}
      hasModifications={hasModifications}
      deletedOnServer={deletedOnServer}
      disablePadding
      secondaryAction={
        <IconButton
          data-testid="layout-actions"
          aria-controls={contextMenuTarget != undefined ? "layout-action-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={contextMenuTarget != undefined ? "true" : undefined}
          onClick={handleMenuButtonClick}
          onContextMenu={handleContextMenu}
        >
          {actionIcon}
        </IconButton>
      }
    >
      <ListItemButton
        data-testid="layout-list-item"
        selected={selected || multiSelectedIds.includes(layout.id)}
        onSubmit={onSubmit}
        onClick={editingName ? undefined : onClick}
        onContextMenu={editingName ? undefined : handleContextMenu}
        component="form"
      >
        <ListItemText disableTypography>
          <TextField
            inputRef={nameInputRef}
            value={nameFieldValue}
            onChange={(event) => setNameFieldValue(event.target.value)}
            onKeyDown={onTextFieldKeyDown}
            onBlur={onBlur}
            fullWidth
            style={{
              font: "inherit",
              display: editingName ? "inline" : "none",
            }}
            size="small"
            variant="filled"
          />
          <Typography
            component="span"
            variant="inherit"
            color="inherit"
            noWrap
            style={{ display: editingName ? "none" : "block" }}
          >
            {layout.name}
          </Typography>
        </ListItemText>
      </ListItemButton>
      <Menu
        id="layout-action-menu"
        open={contextMenuTarget != undefined}
        disableAutoFocus
        disableRestoreFocus
        anchorReference={contextMenuTarget?.type === "position" ? "anchorPosition" : "anchorEl"}
        anchorPosition={
          contextMenuTarget?.type === "position"
            ? { top: contextMenuTarget.mouseY, left: contextMenuTarget.mouseX }
            : undefined
        }
        anchorEl={contextMenuTarget?.element}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "layout-actions",
          dense: true,
        }}
      >
        {filteredItems.map((item) => {
          switch (item.type) {
            case "divider":
              return <Divider key={item.key} variant="middle" />;
            case "item":
              return (
                <StyledMenuItem
                  debug={item.debug}
                  disabled={item.disabled}
                  key={item.key}
                  data-testid={item["data-testid"]}
                  onClick={(event) => {
                    item.onClick?.(event);
                    handleClose();
                  }}
                >
                  <Typography variant="inherit" color={item.key === "delete" ? "error" : undefined}>
                    {item.text}
                  </Typography>
                </StyledMenuItem>
              );
            case "header":
              return (
                <MenuItem disabled key={item.key}>
                  {item.text}
                </MenuItem>
              );
            default:
              return undefined;
          }
        })}
      </Menu>
    </StyledListItem>
  );
});
