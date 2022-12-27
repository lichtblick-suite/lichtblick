// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

enum AppEventCategory {
  LIFECYCLE = "LIFECYCLE",
  DIALOG = "DIALOG",
  PLAYERS = "PLAYERS",
  LAYOUTS = "LAYOUTS",
  PANELS = "PANELS",
  VARIABLES = "VARIABLES",
  EXTENSIONS = "EXTENSIONS",
  EXPERIMENTAL_FEATURES = "EXPERIMENTAL_FEATURES",
}

enum AppEvent {
  APP_INIT = "Studio: App initiated",

  // Dialog events
  DIALOG_SELECT_VIEW = "Studio: Dialog view selected",
  DIALOG_CLOSE = "Studio: Dialog closed",
  DIALOG_CLICK_CTA = "Studio: Dialog CTA clicked",

  // Player events
  PLAYER_CONSTRUCTED = "Studio: Player constructed",
  PLAYER_PLAY = "Studio: Player played",
  PLAYER_SEEK = "Studio: Player seeked",
  PLAYER_SET_SPEED = "Studio: Player speed set",
  PLAYER_PAUSE = "Studio: Player paused",
  PLAYER_CLOSE = "Studio: Player closed",

  // Layout events
  LAYOUT_UPDATE = "Studio: Layout updated",
  LAYOUT_CREATE = "Studio: Layout created",
  LAYOUT_DUPLICATE = "Studio: Layout duplicated",
  LAYOUT_RENAME = "Studio: Layout renamed",
  LAYOUT_DELETE = "Studio: Layout deleted",
  LAYOUT_SELECT = "Studio: Layout selected",
  LAYOUT_IMPORT = "Studio: Layout imported",
  LAYOUT_EXPORT = "Studio: Layout exported",
  LAYOUT_SHARE = "Studio: Layout shared",
  LAYOUT_OVERWRITE = "Studio: Layout overwritten",
  LAYOUT_REVERT = "Studio: Layout reverted",
  LAYOUT_MAKE_PERSONAL_COPY = "Studio: Layout personal copy made",

  // Panel events
  PANEL_ADD = "Studio: Panel added",
  PANEL_DELETE = "Studio: Panel deleted",

  // Variable events
  VARIABLE_ADD = "Studio: Variable added",
  VARIABLE_DELETE = "Studio: Variable deleted",

  // Extension events
  EXTENSION_INSTALL = "Studio: Extension installed",
  EXTENSION_UNINSTALL = "Studio: Extension uninstalled",

  // Experimental features
  EXPERIMENTAL_FEATURE_TOGGLE = "Studio: Experimental feature toggled",
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

    case AppEvent.DIALOG_SELECT_VIEW:
    case AppEvent.DIALOG_CLOSE:
    case AppEvent.DIALOG_CLICK_CTA:
      return AppEventCategory.DIALOG;

    case AppEvent.PLAYER_CONSTRUCTED:
    case AppEvent.PLAYER_PLAY:
    case AppEvent.PLAYER_SEEK:
    case AppEvent.PLAYER_SET_SPEED:
    case AppEvent.PLAYER_PAUSE:
    case AppEvent.PLAYER_CLOSE:
      return AppEventCategory.PLAYERS;

    case AppEvent.LAYOUT_UPDATE:
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

    case AppEvent.VARIABLE_ADD:
    case AppEvent.VARIABLE_DELETE:
      return AppEventCategory.VARIABLES;

    case AppEvent.EXTENSION_INSTALL:
    case AppEvent.EXTENSION_UNINSTALL:
      return AppEventCategory.EXTENSIONS;

    case AppEvent.EXPERIMENTAL_FEATURE_TOGGLE:
      return AppEventCategory.EXPERIMENTAL_FEATURES;
  }
}

export function getEventBreadcrumbType(event: AppEvent): SentryBreadcrumbType {
  switch (event) {
    case AppEvent.APP_INIT:
      return SentryBreadcrumbType.DEFAULT;

    case AppEvent.DIALOG_SELECT_VIEW:
    case AppEvent.DIALOG_CLOSE:
    case AppEvent.DIALOG_CLICK_CTA:
      return SentryBreadcrumbType.USER;

    case AppEvent.PLAYER_CONSTRUCTED:
      return SentryBreadcrumbType.TRANSACTION;

    case AppEvent.PLAYER_PLAY:
    case AppEvent.PLAYER_SEEK:
    case AppEvent.PLAYER_SET_SPEED:
    case AppEvent.PLAYER_PAUSE:
      return SentryBreadcrumbType.USER;

    case AppEvent.PLAYER_CLOSE:
      return SentryBreadcrumbType.TRANSACTION;

    case AppEvent.LAYOUT_UPDATE:
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

    case AppEvent.VARIABLE_ADD:
    case AppEvent.VARIABLE_DELETE:
      return SentryBreadcrumbType.USER;

    case AppEvent.EXTENSION_INSTALL:
    case AppEvent.EXTENSION_UNINSTALL:
      return SentryBreadcrumbType.USER;

    case AppEvent.EXPERIMENTAL_FEATURE_TOGGLE:
      return SentryBreadcrumbType.USER;
  }
}

interface IAnalytics {
  logEvent(event: AppEvent, data?: { [key: string]: unknown }): void | Promise<void>;
}

export { AppEvent };
export default IAnalytics;
