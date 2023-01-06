// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

enum AppEventCategory {
  LIFECYCLE = "LIFECYCLE",
  DIALOG = "DIALOG",
  APP_BAR = "APP_BAR",
  HELP_MENU = "HELP_MENU",
  PLAYERS = "PLAYERS",
  LAYOUTS = "LAYOUTS",
  PANELS = "PANELS",
  VARIABLES = "VARIABLES",
  EXTENSIONS = "EXTENSIONS",
  EXPERIMENTAL_FEATURES = "EXPERIMENTAL_FEATURES",
}

enum AppEvent {
  APP_INIT = "Studio: App Initialized",

  // Dialog events
  DIALOG_SELECT_VIEW = "Studio: Dialog View Selected",
  DIALOG_CLOSE = "Studio: Dialog Closed",
  DIALOG_CLICK_CTA = "Studio: Dialog CTA Clicked",

  // App Bar events
  APP_BAR_CLICK_CTA = "Studio: App Bar CTA CLicked",

  // Help Menu events
  HELP_MENU_CLICK_CTA = "Studio: Help Menu CTA Clicked",

  // Player events
  PLAYER_CONSTRUCTED = "Studio: Player Constructed",
  PLAYER_PLAY = "Studio: Player Played",
  PLAYER_SEEK = "Studio: Player Seeked",
  PLAYER_SET_SPEED = "Studio: Player Speed Set",
  PLAYER_PAUSE = "Studio: Player Paused",
  PLAYER_CLOSE = "Studio: Player Closed",

  // Layout events
  LAYOUT_UPDATE = "Studio: Layout Updated",
  LAYOUT_CREATE = "Studio: Layout Created",
  LAYOUT_DUPLICATE = "Studio: Layout Duplicated",
  LAYOUT_RENAME = "Studio: Layout Renamed",
  LAYOUT_DELETE = "Studio: Layout Deleted",
  LAYOUT_SELECT = "Studio: Layout Selected",
  LAYOUT_IMPORT = "Studio: Layout Imported",
  LAYOUT_EXPORT = "Studio: Layout Exported",
  LAYOUT_SHARE = "Studio: Layout Shared",
  LAYOUT_OVERWRITE = "Studio: Layout Overwritten",
  LAYOUT_REVERT = "Studio: Layout Reverted",
  LAYOUT_MAKE_PERSONAL_COPY = "Studio: Layout Personal Copy Made",

  // Panel events
  PANEL_ADD = "Studio: Panel Added",
  PANEL_DELETE = "Studio: Panel Deleted",

  // Variable events
  VARIABLE_ADD = "Studio: Variable Added",
  VARIABLE_DELETE = "Studio: Variable Deleted",

  // Extension events
  EXTENSION_INSTALL = "Studio: Extension Installed",
  EXTENSION_UNINSTALL = "Studio: Extension Uninstalled",

  // Experimental features
  EXPERIMENTAL_FEATURE_TOGGLE = "Studio: Experimental Feature Toggled",
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

    case AppEvent.APP_BAR_CLICK_CTA:
      return AppEventCategory.APP_BAR;

    case AppEvent.HELP_MENU_CLICK_CTA:
      return AppEventCategory.HELP_MENU;

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

    case AppEvent.APP_BAR_CLICK_CTA:
      return SentryBreadcrumbType.USER;

    case AppEvent.HELP_MENU_CLICK_CTA:
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
