// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ErrorIcon from "@mui/icons-material/Error";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {
  Divider,
  IconButton,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  SvgIcon,
  TextField,
  Typography,
} from "@mui/material";
import {
  MouseEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useMountedState } from "react-use";

import { useLayoutManager } from "@lichtblick/suite-base/context/LayoutManagerContext";
import { useConfirm } from "@lichtblick/suite-base/hooks/useConfirm";
import { Layout, layoutIsShared } from "@lichtblick/suite-base/services/ILayoutStorage";

import { StyledListItem, StyledMenuItem } from "./LayoutRow.style";
import { LayoutActionMenuItem } from "./types";

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
}): React.JSX.Element {
  const isMounted = useMountedState();
  const [confirm, confirmModal] = useConfirm();
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
    const onlineListener = () => {
      setIsOnline(layoutManager.isOnline);
    };
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

  const renameAction = useCallback(() => {
    setNameFieldValue(layout.name);
    setEditingName(true);
  }, [layout]);

  const duplicateAction = useCallback(() => {
    if (layoutIsShared(layout)) {
      onMakePersonalCopy(layout);
    } else {
      onDuplicate(layout);
    }
  }, [layout, onDuplicate, onMakePersonalCopy]);

  const shareAction = useCallback(() => {
    onShare(layout);
  }, [layout, onShare]);

  const exportAction = useCallback(() => {
    onExport(layout);
  }, [layout, onExport]);

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
    const { currentTarget } = event;
    setContextMenuTarget((target) =>
      target == undefined ? { type: "element", element: currentTarget } : undefined,
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
    // For shared layouts, "Make a personal copy" is always available
    // For personal layouts, "Duplicate" is available if no modifications
    (layoutIsShared(layout) || !hasModifications) && {
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
      "data-testid": "export-layout",
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

  if (hasModifications) {
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
        onClick: () => {
          void confirmRevert();
        },
        disabled: deletedOnServer,
      },
    ];

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

  const filteredItems = menuItems.filter(
    (item): item is LayoutActionMenuItem => typeof item === "object",
  );

  const actionIcon = useMemo(() => {
    let icon;
    if (deletedOnServer) {
      icon = <ErrorIcon fontSize="small" color="error" />;
    } else if (hasModifications) {
      icon = (
        <SvgIcon fontSize="small" color="primary">
          <circle cx={12} cy={12} r={4} />
        </SvgIcon>
      );
    } else {
      icon = <MoreVertIcon fontSize="small" />;
    }
    return icon;
  }, [deletedOnServer, hasModifications]);

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
      {confirmModal}
      <ListItemButton
        data-testid="layout-list-item"
        selected={selected || multiSelectedIds.includes(layout.id)}
        onSubmit={onSubmit}
        onClick={(event) => {
          // Toggle selection for multi-select support
          onSelect(layout, { selectedViaClick: true, event });
        }}
        onContextMenu={editingName ? undefined : handleContextMenu}
        component="form"
      >
        <ListItemText disableTypography>
          <TextField
            inputRef={nameInputRef}
            value={nameFieldValue}
            onChange={(event) => {
              setNameFieldValue(event.target.value);
            }}
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
        slotProps={{
          list: {
            "aria-labelledby": "layout-actions",
            dense: true,
          },
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
