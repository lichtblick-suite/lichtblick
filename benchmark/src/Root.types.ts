// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export type RootProps = {
  /**
   * Called once after the root's first commit (used to emit the `app.ready` telemetry event): the
   * providers and `StudioApp` are mounted, but the layout, data source and panels are not ready.
   */
  onAppReady?: () => void;
};
