// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Checkmark16Regular, ChevronDown12Regular } from "@fluentui/react-icons";
import { Button, Divider, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

import { useWorkspaces } from "@lichtblick/suite-base/context/WorkspacesContext";
import { useConfirm } from "@lichtblick/suite-base/hooks/useConfirm";
import { usePrompt } from "@lichtblick/suite-base/hooks/usePrompt";
import { Namespace } from "@lichtblick/suite-base/types";
import isDesktopApp from "@lichtblick/suite-base/util/isDesktopApp";

import { useStyles } from "./WorkspaceSwitcher.style";

/**
 * AppBar dropdown to view and switch the active workspace and perform workspace CRUD. Rendered only
 * on desktop and only when a workspaces provider is present, so it stays hidden on the web build.
 */
export function WorkspaceSwitcher(): React.JSX.Element | ReactNull {
  const { classes } = useStyles();
  const { t } = useTranslation("workspaces");
  const workspacesContext = useWorkspaces();

  const [prompt, promptModal] = usePrompt();
  const [confirm, confirmModal] = useConfirm();

  const [anchorEl, setAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const open = Boolean(anchorEl);

  const handleClose = useCallback(() => {
    setAnchorEl(undefined);
  }, []);

  const handleCreate = useCallback(
    (namespace: Namespace) => {
      void (async () => {
        handleClose();
        const name = await prompt({
          title: t("createWorkspaceTitle"),
          placeholder: t("workspaceNamePlaceholder"),
        });
        if (name == undefined || name.trim().length === 0) {
          return;
        }
        const workspace = await workspacesContext?.createWorkspace(name, namespace);
        if (workspace) {
          await workspacesContext?.switchWorkspace(workspace.id);
        }
      })();
    },
    [handleClose, prompt, t, workspacesContext],
  );

  const handleRename = useCallback(
    (id: string, currentName: string) => {
      void (async () => {
        handleClose();
        const name = await prompt({
          title: t("renameWorkspaceTitle"),
          placeholder: t("workspaceNamePlaceholder"),
          initialValue: currentName,
        });
        if (name == undefined || name.trim().length === 0) {
          return;
        }
        await workspacesContext?.renameWorkspace(id, name);
      })();
    },
    [handleClose, prompt, t, workspacesContext],
  );

  const handleDelete = useCallback(
    (id: string, name: string) => {
      void (async () => {
        handleClose();
        const response = await confirm({
          title: t("deleteWorkspaceTitle", { name }),
          prompt: t("deleteWorkspacePrompt"),
          ok: t("delete"),
          variant: "danger",
        });
        if (response !== "ok") {
          return;
        }
        await workspacesContext?.deleteWorkspace(id);
      })();
    },
    [handleClose, confirm, t, workspacesContext],
  );

  const handleSwitch = useCallback(
    (id: string | undefined) => {
      handleClose();
      void workspacesContext?.switchWorkspace(id);
    },
    [handleClose, workspacesContext],
  );

  // Hidden on web (no provider) and on non-desktop builds.
  if (!workspacesContext || !isDesktopApp()) {
    return ReactNull;
  }

  const { workspaces, currentWorkspace } = workspacesContext;
  const currentLabel = currentWorkspace?.name ?? t("legacyWorkspace");

  return (
    <>
      <Button
        className={classes.button}
        variant="outlined"
        size="small"
        color="inherit"
        data-testid="workspace-switcher-button"
        aria-controls={open ? "workspace-switcher-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        endIcon={<ChevronDown12Regular />}
        onClick={(event) => {
          setAnchorEl(event.currentTarget);
        }}
      >
        <span className={classes.buttonLabel}>{currentLabel}</span>
      </Button>
      <Menu
        id="workspace-switcher-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{ list: { className: classes.menuList, dense: true } }}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
      >
        <MenuItem
          selected={currentWorkspace == undefined}
          data-testid="workspace-item-legacy"
          onClick={() => {
            handleSwitch(undefined);
          }}
        >
          <ListItemIcon>
            {currentWorkspace == undefined && <Checkmark16Regular />}
          </ListItemIcon>
          <ListItemText
            classes={{ primary: classes.menuText }}
            primary={t("legacyWorkspace")}
          />
        </MenuItem>

        {workspaces.length > 0 && <Divider />}

        {workspaces.map((workspace) => {
          const selected = workspace.id === currentWorkspace?.id;
          return (
            <MenuItem
              key={workspace.id}
              selected={selected}
              data-testid="workspace-item"
              onClick={() => {
                handleSwitch(workspace.id);
              }}
            >
              <ListItemIcon>{selected && <Checkmark16Regular />}</ListItemIcon>
              <ListItemText
                classes={{ primary: classes.menuText }}
                primary={workspace.name}
              />
            </MenuItem>
          );
        })}

        <Divider />

        <MenuItem
          data-testid="create-personal-workspace"
          onClick={() => {
            handleCreate("local");
          }}
        >
          {t("createWorkspace")}
        </MenuItem>

        {currentWorkspace != undefined && [
          <MenuItem
            key="rename"
            data-testid="rename-workspace"
            onClick={() => {
              handleRename(currentWorkspace.id, currentWorkspace.name);
            }}
          >
            {t("renameWorkspace")}
          </MenuItem>,
          <MenuItem
            key="delete"
            data-testid="delete-workspace"
            onClick={() => {
              handleDelete(currentWorkspace.id, currentWorkspace.name);
            }}
          >
            {t("deleteWorkspace")}
          </MenuItem>,
        ]}
      </Menu>
      {promptModal}
      {confirmModal}
    </>
  );
}
