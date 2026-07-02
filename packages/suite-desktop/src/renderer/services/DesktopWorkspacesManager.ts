// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IWorkspacesManager, Workspace } from "@lichtblick/suite-base";
import { Namespace } from "@lichtblick/suite-base/src/types/Namespace";

import { Desktop, DesktopWorkspace } from "../../common/types";

function toWorkspace(workspace: DesktopWorkspace): Workspace {
  return { id: workspace.id, name: workspace.name, namespace: workspace.namespace };
}

/**
 * Desktop implementation of {@link IWorkspacesManager}. Delegates all operations to the main process
 * through the Electron bridge and maps the on-disk workspace representation to the shared type.
 */
export class DesktopWorkspacesManager implements IWorkspacesManager {
  #bridge: Desktop;

  public constructor(bridge: Desktop) {
    this.#bridge = bridge;
  }

  public list = async (): Promise<Workspace[]> => {
    const workspaces = await this.#bridge.listWorkspaces();
    return workspaces.map(toWorkspace);
  };

  public create = async (name: string, namespace: Namespace): Promise<Workspace> => {
    return toWorkspace(await this.#bridge.createWorkspace(name, namespace));
  };

  public rename = async (id: string, name: string): Promise<Workspace> => {
    return toWorkspace(await this.#bridge.renameWorkspace(id, name));
  };

  public delete = async (id: string): Promise<void> => {
    await this.#bridge.deleteWorkspace(id);
  };

  public getCurrent = async (): Promise<Workspace | undefined> => {
    const workspace = await this.#bridge.getCurrentWorkspace();
    return workspace == undefined ? undefined : toWorkspace(workspace);
  };

  public setCurrent = async (id: string | undefined): Promise<void> => {
    await this.#bridge.setCurrentWorkspace(id);
  };
}
