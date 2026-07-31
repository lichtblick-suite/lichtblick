// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { test as base, _electron as electron, ElectronApplication, Page } from "@playwright/test";
import electronPath from "electron";
import fs from "fs";
import { mkdtemp } from "fs/promises";
import * as os from "os";
import path from "path";

export type PreSeededWorkspace = {
  /** Stable workspace id; also the on-disk folder name under `workspaces/`. */
  id: string;
  /** Human-readable workspace name persisted in `workspace.json`. */
  name: string;
  /** Namespace/type of the workspace artifacts. Defaults to "local" (personal). */
  namespace?: "local" | "org";
  /** Extension asset filenames (under e2e/fixtures/assets) to copy into the workspace. */
  extensions?: string[];
  /** Layout asset filenames (under e2e/fixtures/assets) to copy into the workspace. */
  layouts?: string[];
  /** When true this workspace is written as the current selection in `state.json`. */
  current?: boolean;
};

export type ElectronFixtures = {
  electronApp: ElectronApplication;
  mainWindow: Page;
  preInstalledExtensions?: string[];
  // Playwright treats an option value that is an array whose second element is an object as a
  // `[value, options]` fixture tuple (see `isFixtureTuple`), which silently collapses a bare
  // `PreSeededWorkspace[]` down to its first entry and crashes the fixture with
  // "object is not iterable". Wrapping the list in an object keeps it passed through intact.
  preSeededWorkspaces?: { workspaces: PreSeededWorkspace[] };
};

const WEBPACK_PATH = path.resolve(__dirname, "../../desktop/.webpack");

export const test = base.extend<ElectronFixtures & { electronArgs: string[] }>({
  electronArgs: [[], { option: true }],
  preInstalledExtensions: [[], { option: true }],
  preSeededWorkspaces: [{ workspaces: [] }, { option: true }],

  electronApp: async ({ electronArgs, preInstalledExtensions, preSeededWorkspaces }, use) => {
    checkBuild(WEBPACK_PATH);

    const userDataDir = await mkdtemp(path.join(os.tmpdir(), "e2e-test-"));
    const homeDir = await mkdtemp(path.join(os.tmpdir(), "home-e2e-test-"));

    for (const filename of preInstalledExtensions ?? []) {
      preInstallExtensionInUserFolder(homeDir, filename);
    }

    for (const workspace of preSeededWorkspaces?.workspaces ?? []) {
      preSeedWorkspace(homeDir, workspace);
    }

    const app = await electron.launch({
      args: [
        WEBPACK_PATH,
        `--user-data-dir=${userDataDir}`,
        `--home-dir=${homeDir}`,
        // Force ANGLE's SwiftShader backend so GPU-heavy panels (3D/WebGL, Image)
        // render reliably under headless CI. Newer Chromium (Electron 42) changed
        // its SwiftShader fallback, which slowed panel initialization past the
        // Playwright per-test timeout.
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        ...electronArgs,
      ],
      executablePath: electronPath as unknown as string,
    });
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture `use`, not React hook
    await use(app);
    await app.close();
  },

  mainWindow: async ({ electronApp }, use) => {
    const mainAppWindow = await electronApp.firstWindow();
    // eslint-disable-next-line react-hooks/rules-of-hooks -- Playwright fixture `use`, not React hook
    await use(mainAppWindow);
  },
});

function checkBuild(webpackPath: string): void {
  if (!fs.existsSync(webpackPath)) {
    throw new Error(`Webpack path does not exist: ${webpackPath}`);
  }
  const files = fs.readdirSync(webpackPath);
  if (files.length === 0) {
    throw new Error(`Webpack path is empty: ${webpackPath}`);
  }
}

function preInstallExtensionInUserFolder(homeDir: string, filename: string): void {
  const source = path.join(process.cwd(), "e2e", "fixtures", "assets", filename);

  if (!fs.existsSync(source)) {
    throw new Error(`Extension asset not found: ${source}`);
  }

  const extensionsDir = path.join(homeDir, ".lichtblick-suite", "extensions");
  fs.mkdirSync(extensionsDir, { recursive: true });

  const stats = fs.statSync(source);
  if (stats.isDirectory()) {
    const destDir = path.join(extensionsDir, filename);
    fs.cpSync(source, destDir, { recursive: true });
  } else {
    fs.copyFileSync(source, path.join(extensionsDir, filename));
  }
}

// Mirrors the on-disk workspace layout owned by the desktop main process
// (packages/suite-desktop/src/common/workspaces.ts). Kept as literals so the standalone e2e build
// does not depend on the app packages.
function copyAsset(source: string, destDir: string, filename: string): void {
  if (!fs.existsSync(source)) {
    throw new Error(`Workspace asset not found: ${source}`);
  }
  fs.mkdirSync(destDir, { recursive: true });
  const stats = fs.statSync(source);
  if (stats.isDirectory()) {
    fs.cpSync(source, path.join(destDir, filename), { recursive: true });
  } else {
    fs.copyFileSync(source, path.join(destDir, filename));
  }
}

function preSeedWorkspace(homeDir: string, workspace: PreSeededWorkspace): void {
  const assetsDir = path.join(process.cwd(), "e2e", "fixtures", "assets");
  const workspacesDir = path.join(homeDir, ".lichtblick-suite", "workspaces");
  const workspaceDir = path.join(workspacesDir, workspace.id);
  const extensionsDir = path.join(workspaceDir, "extensions");
  const layoutsDir = path.join(workspaceDir, "layouts");

  fs.mkdirSync(extensionsDir, { recursive: true });
  fs.mkdirSync(layoutsDir, { recursive: true });

  const now = new Date().toISOString();
  const config = {
    id: workspace.id,
    name: workspace.name,
    namespace: workspace.namespace ?? "local",
    createdAt: now,
    updatedAt: now,
  };
  fs.writeFileSync(path.join(workspaceDir, "workspace.json"), JSON.stringify(config, undefined, 2));

  for (const filename of workspace.extensions ?? []) {
    copyAsset(path.join(assetsDir, filename), extensionsDir, filename);
  }
  for (const filename of workspace.layouts ?? []) {
    copyAsset(path.join(assetsDir, filename), layoutsDir, filename);
  }

  if (workspace.current === true) {
    fs.writeFileSync(
      path.join(workspacesDir, "state.json"),
      JSON.stringify({ currentWorkspaceId: workspace.id }, undefined, 2),
    );
  }
}

export { expect } from "@playwright/test";
