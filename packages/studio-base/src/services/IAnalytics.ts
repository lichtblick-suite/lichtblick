// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

enum AppEventCategory {
  LIFECYCLE = "LIFECYCLE",
  PLAYERS = "PLAYERS",
  LAYOUTS = "LAYOUTS",
  PANELS = "PANELS",
}

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
  LAYOUT_OVERWRITE = "LAYOUT_OVERWRITE",
  LAYOUT_REVERT = "LAYOUT_REVERT",
  LAYOUT_MAKE_PERSONAL_COPY = "LAYOUT_MAKE_PERSONAL_COPY",

  // Panel events
  PANEL_ADD = "PANEL_ADD",
  PANEL_DELETE = "PANEL_DELETE",
}

/** https://develop.sentry.dev/sdk/event-payloads/breadcrumbs/#breadcrumb-types */
enum SentryBreadcrumbType {
  DEFAULT = "default",
  DEBUG = "debug",
  ERROR = "error",
  NAVIGATION = "navigation",
  HTTP = "http",
  INFO = "info",
  QUERY = "query",
  TRANSACTION = "transaction",
  UI = "ui",
  USER = "user",
}

export function getEventCategory(event: AppEvent): AppEventCategory {
  switch (event) {
    case AppEvent.APP_INIT:
      return AppEventCategory.LIFECYCLE;

    case AppEvent.PLAYER_CONSTRUCTED:
    case AppEvent.PLAYER_INITIALIZED:
    case AppEvent.PLAYER_PLAY:
    case AppEvent.PLAYER_SEEK:
    case AppEvent.PLAYER_SET_SPEED:
    case AppEvent.PLAYER_PAUSE:
    case AppEvent.PLAYER_CLOSE:
      return AppEventCategory.PLAYERS;

    case AppEvent.LAYOUT_CREATE:
    case AppEvent.LAYOUT_DUPLICATE:
    case AppEvent.LAYOUT_RENAME:
    case AppEvent.LAYOUT_DELETE:
    case AppEvent.LAYOUT_SELECT:
    case AppEvent.LAYOUT_IMPORT:
    case AppEvent.LAYOUT_EXPORT:
    case AppEvent.LAYOUT_SHARE:
    case AppEvent.LAYOUT_OVERWRITE:
    case AppEvent.LAYOUT_REVERT:
    case AppEvent.LAYOUT_MAKE_PERSONAL_COPY:
      return AppEventCategory.LAYOUTS;

    case AppEvent.PANEL_ADD:
    case AppEvent.PANEL_DELETE:
      return AppEventCategory.PANELS;
  }
}

export function getEventBreadcrumbType(event: AppEvent): SentryBreadcrumbType {
  switch (event) {
    case AppEvent.APP_INIT:
      return SentryBreadcrumbType.DEFAULT;

    case AppEvent.PLAYER_CONSTRUCTED:
    case AppEvent.PLAYER_INITIALIZED:
      return SentryBreadcrumbType.TRANSACTION;

    case AppEvent.PLAYER_PLAY:
    case AppEvent.PLAYER_SEEK:
    case AppEvent.PLAYER_SET_SPEED:
    case AppEvent.PLAYER_PAUSE:
      return SentryBreadcrumbType.USER;

    case AppEvent.PLAYER_CLOSE:
      return SentryBreadcrumbType.TRANSACTION;

    case AppEvent.LAYOUT_CREATE:
    case AppEvent.LAYOUT_DUPLICATE:
    case AppEvent.LAYOUT_RENAME:
    case AppEvent.LAYOUT_DELETE:
    case AppEvent.LAYOUT_SELECT:
    case AppEvent.LAYOUT_IMPORT:
    case AppEvent.LAYOUT_EXPORT:
    case AppEvent.LAYOUT_SHARE:
    case AppEvent.LAYOUT_OVERWRITE:
    case AppEvent.LAYOUT_REVERT:
    case AppEvent.LAYOUT_MAKE_PERSONAL_COPY:
    case AppEvent.PANEL_ADD:
    case AppEvent.PANEL_DELETE:
      return SentryBreadcrumbType.USER;
  }
}

interface IAnalytics {
  logEvent(event: AppEvent, data?: { [key: string]: unknown }): void | Promise<void>;
}

export { AppEvent };
export default IAnalytics;
