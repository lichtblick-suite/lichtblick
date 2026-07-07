// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join as pathJoin } from "node:path";

import Logger from "@lichtblick/log";

import { DesktopWorkspace, WorkspaceNamespace } from "../../common/types";
import {
  WorkspaceConfig,
  WorkspacesState,
  WORKSPACES_STATE_FILE,
  WORKSPACE_CONFIG_FILE,
  WORKSPACE_EXTENSIONS_FOLDER,
  WORKSPACE_LAYOUTS_FOLDER,
} from "../../common/workspaces";

const log = Logger.getLogger(__filename);

/**
 * Filesystem-backed manager for desktop workspaces. Each workspace is a folder under the
 * `workspacesRoot` directory containing a `workspace.json` config plus `extensions/` and `layouts/`
 * sub-folders. The currently selected workspace id is persisted in `state.json` at the root.
 */
export class WorkspacesManager {
  readonly #workspacesRoot: string;

  // Serializes read-modify-write cycles on state.json so concurrent IPC requests cannot interleave
  // and clobber each other's writes (e.g. currentWorkspaceId).
  #stateQueue: Promise<unknown> = Promise.resolve();

  public constructor(workspacesRoot: string) {
    this.#workspacesRoot = workspacesRoot;
  }

  /**
   * Guards against path traversal from renderer-supplied ids. Workspace ids are created via
   * randomUUID(), so a valid id is always a single, plain path segment.
   */
  #assertValidId(id: string): void {
    if (
      id.trim().length === 0 ||
      id === "." ||
      id === ".." ||
      id.includes("/") ||
      id.includes("\\") ||
      id !== basename(id)
    ) {
      throw new Error(`Invalid workspace id: ${id}`);
    }
  }

  /** Chains onto the state write queue so read-update-write sequences run serially. */
  async #withStateLock<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.#stateQueue.then(async () => await fn());
    // Reset the queue to the settled promise regardless of outcome so a rejection does not wedge it.
    this.#stateQueue = run.then(
      () => undefined,
      () => undefined,
    );
    return await run;
  }

  #configPath(id: string): string {
    this.#assertValidId(id);
    return pathJoin(this.#workspacesRoot, id, WORKSPACE_CONFIG_FILE);
  }

  #statePath(): string {
    return pathJoin(this.#workspacesRoot, WORKSPACES_STATE_FILE);
  }

  #toWorkspace(config: WorkspaceConfig): DesktopWorkspace {
    return {
      id: config.id,
      name: config.name,
      namespace: config.namespace,
      path: pathJoin(this.#workspacesRoot, config.id),
    };
  }

  async #readState(): Promise<WorkspacesState> {
    try {
      const raw = await readFile(this.#statePath(), { encoding: "utf-8" });
      return JSON.parse(raw) as WorkspacesState;
    } catch {
      return {};
    }
  }

  async #writeState(state: WorkspacesState): Promise<void> {
    await mkdir(this.#workspacesRoot, { recursive: true });
    await writeFile(this.#statePath(), JSON.stringify(state, undefined, 2) ?? "", {
      encoding: "utf-8",
    });
  }

  public async getConfig(id: string): Promise<WorkspaceConfig | undefined> {
    // Validate before the try/catch so an invalid id surfaces as an error (callers such as rename
    // rely on this) rather than being swallowed as a missing-config undefined.
    this.#assertValidId(id);
    try {
      const raw = await readFile(this.#configPath(id), { encoding: "utf-8" });
      return JSON.parse(raw) as WorkspaceConfig;
    } catch {
      return undefined;
    }
  }

  public async list(): Promise<DesktopWorkspace[]> {
    if (!existsSync(this.#workspacesRoot)) {
      return [];
    }

    const entries = await readdir(this.#workspacesRoot, { withFileTypes: true });
    const workspaces: DesktopWorkspace[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const config = await this.getConfig(entry.name);
      if (config == undefined) {
        continue;
      }
      workspaces.push(this.#toWorkspace(config));
    }

    workspaces.sort((a, b) => a.name.localeCompare(b.name));
    return workspaces;
  }

  public async create(name: string, namespace: WorkspaceNamespace): Promise<DesktopWorkspace> {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error("Workspace name cannot be empty");
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    const config: WorkspaceConfig = {
      id,
      name: trimmed,
      namespace,
      createdAt: now,
      updatedAt: now,
    };

    const workspaceDir = pathJoin(this.#workspacesRoot, id);
    await mkdir(pathJoin(workspaceDir, WORKSPACE_EXTENSIONS_FOLDER), { recursive: true });
    await mkdir(pathJoin(workspaceDir, WORKSPACE_LAYOUTS_FOLDER), { recursive: true });
    await writeFile(this.#configPath(id), JSON.stringify(config, undefined, 2) ?? "", {
      encoding: "utf-8",
    });

    log.info(`Created workspace "${trimmed}" (${id})`);
    return this.#toWorkspace(config);
  }

  public async rename(id: string, name: string): Promise<DesktopWorkspace> {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error("Workspace name cannot be empty");
    }

    const config = await this.getConfig(id);
    if (config == undefined) {
      throw new Error(`Workspace ${id} not found`);
    }

    const updated: WorkspaceConfig = {
      ...config,
      name: trimmed,
      updatedAt: new Date().toISOString(),
    };
    await writeFile(this.#configPath(id), JSON.stringify(updated, undefined, 2) ?? "", {
      encoding: "utf-8",
    });

    return this.#toWorkspace(updated);
  }

  public async delete(id: string): Promise<void> {
    this.#assertValidId(id);
    await rm(pathJoin(this.#workspacesRoot, id), { recursive: true, force: true });

    await this.#withStateLock(async () => {
      const state = await this.#readState();
      if (state.currentWorkspaceId === id) {
        await this.#writeState({ ...state, currentWorkspaceId: undefined });
      }
    });

    log.info(`Deleted workspace ${id}`);
  }

  public async getCurrent(): Promise<DesktopWorkspace | undefined> {
    const { currentWorkspaceId } = await this.#readState();
    if (currentWorkspaceId == undefined) {
      return undefined;
    }

    const config = await this.getConfig(currentWorkspaceId);
    // If the persisted workspace no longer exists, fall back to the legacy folders.
    return config == undefined ? undefined : this.#toWorkspace(config);
  }

  public async setCurrent(id: string | undefined): Promise<void> {
    if (id != undefined) {
      this.#assertValidId(id);
      const config = await this.getConfig(id);
      if (config == undefined) {
        throw new Error(`Workspace ${id} not found`);
      }
    }

    await this.#withStateLock(async () => {
      const state = await this.#readState();
      await this.#writeState({ ...state, currentWorkspaceId: id });
    });
  }
}
