// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

enum AppEvent {
  APP_INIT = "APP_INIT",

  // PlayerMetricsCollectorInterface events
  PLAYER_CONSTRUCTED = "PLAYER_CONSTRUCTED",
  PLAYER_INITIALIZED = "PLAYER_INITIALIZED",
  PLAYER_PLAY = "PLAYER_PLAY",
  PLAYER_SEEK = "PLAYER_SEEK",
  PLAYER_SET_SPEED = "PLAYER_SET_SPEED",
  PLAYER_PAUSE = "PLAYER_PAUSE",
  PLAYER_CLOSE = "PLAYER_CLOSE",

  // Layout events
  LAYOUT_CREATE = "LAYOUT_CREATE",
  LAYOUT_DUPLICATE = "LAYOUT_DUPLICATE",
  LAYOUT_RENAME = "LAYOUT_RENAME",
  LAYOUT_DELETE = "LAYOUT_DELETE",
  LAYOUT_SELECT = "LAYOUT_SELECT",
  LAYOUT_IMPORT = "LAYOUT_IMPORT",
  LAYOUT_EXPORT = "LAYOUT_EXPORT",
  LAYOUT_SHARE = "LAYOUT_SHARE",
  LAYOUT_CONFLICT = "LAYOUT_CONFLICT",

  // Panel events
  PANEL_ADD = "PANEL_ADD",
  PANEL_DELETE = "PANEL_DELETE",
}

interface IAnalytics {
  logEvent(event: AppEvent, data?: { [key: string]: unknown }): void | Promise<void>;
}

export { AppEvent };
export default IAnalytics;
