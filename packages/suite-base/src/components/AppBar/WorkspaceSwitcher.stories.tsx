// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { useCallback, useMemo, useState } from "react";

import {
  IWorkspacesManager,
  Workspace,
} from "@lichtblick/suite-base/services/workspaces/IWorkspacesManager";
import { Namespace } from "@lichtblick/suite-base/types";

import { StorybookDecorator } from "./StorybookDecorator.stories";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import WorkspacesProvider from "../../providers/WorkspacesProvider";

// The switcher is desktop-only; fake the desktop bridge so isDesktopApp() is true in Storybook.
(global as unknown as { desktopBridge: unknown }).desktopBridge = {};

/** Minimal in-memory {@link IWorkspacesManager} so the story exercises real CRUD interactions. */
function createFakeManager(initial: Workspace[]): IWorkspacesManager {
  let workspaces = [...initial];
  let currentId: string | undefined = initial[0]?.id;
  let nextId = initial.length;

  return {
    list: async () => [...workspaces],
    create: async (name: string, namespace: Namespace) => {
      const workspace: Workspace = { id: `ws-${++nextId}`, name, namespace };
      workspaces = [...workspaces, workspace];
      return workspace;
    },
    rename: async (id: string, name: string) => {
      workspaces = workspaces.map((w) => (w.id === id ? { ...w, name } : w));
      return workspaces.find((w) => w.id === id)!;
    },
    delete: async (id: string) => {
      workspaces = workspaces.filter((w) => w.id !== id);
    },
    getCurrent: async () => workspaces.find((w) => w.id === currentId),
    setCurrent: async (id: string | undefined) => {
      currentId = id;
    },
  };
}

function WorkspaceSwitcherStory({ initial }: { initial: Workspace[] }): React.JSX.Element {
  const manager = useMemo(() => createFakeManager(initial), [initial]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | undefined>(initial[0]?.id);

  const onSwitchWorkspace = useCallback(() => {
    void (async () => {
      const workspace = await manager.getCurrent();
      setCurrentWorkspaceId(workspace?.id);
    })();
  }, [manager]);

  return (
    <WorkspacesProvider
      manager={manager}
      currentWorkspaceId={currentWorkspaceId}
      onSwitchWorkspace={onSwitchWorkspace}
    >
      <div style={{ padding: 8, display: "flex" }}>
        <WorkspaceSwitcher />
      </div>
    </WorkspacesProvider>
  );
}

export default {
  title: "components/AppBar/WorkspaceSwitcher",
  component: WorkspaceSwitcher,
  decorators: [StorybookDecorator],
};

const sampleWorkspaces: Workspace[] = [
  { id: "ws-1", name: "Personal", namespace: "local" },
  { id: "ws-2", name: "Robotics Team", namespace: "org" },
];

export const WithWorkspaces: StoryObj = {
  render: () => <WorkspaceSwitcherStory initial={sampleWorkspaces} />,
};

export const NoWorkspaces: StoryObj = {
  render: () => <WorkspaceSwitcherStory initial={[]} />,
};
