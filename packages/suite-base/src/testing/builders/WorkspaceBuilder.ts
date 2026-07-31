// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Workspace } from "@lichtblick/suite-base/services/workspaces/IWorkspacesManager";
import { Namespace } from "@lichtblick/suite-base/types";
import { BasicBuilder, defaults } from "@lichtblick/test-builders";

export default class WorkspaceBuilder {
  public static workspace(props: Partial<Workspace> = {}): Workspace {
    return defaults<Workspace>(props, {
      id: BasicBuilder.string(),
      name: BasicBuilder.string(),
      namespace: BasicBuilder.sample(["local", "org"] as Namespace[]),
    });
  }

  public static workspaces(count = 3): Workspace[] {
    return BasicBuilder.multiple(WorkspaceBuilder.workspace, count);
  }
}
