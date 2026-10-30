// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AppBar, AppBarProps } from "@lichtblick/suite-base/components/AppBar";

import { useScenarioBootstrap } from "./useScenarioBootstrap";

/**
 * Renders the default `AppBar` unchanged. Its only purpose is to sit inside `Workspace`'s render
 * tree (unlike `SharedRoot`'s `extraProviders`, which render *outside* `PlayerManager` and
 * `CurrentLayoutProvider`) so `useScenarioBootstrap` can reach `PlayerSelectionContext`,
 * `CurrentLayoutContext`, and `MessagePipelineContext`.
 */
export function BenchmarkAppBar(props: AppBarProps): React.JSX.Element {
  useScenarioBootstrap();
  return <AppBar {...props} />;
}
