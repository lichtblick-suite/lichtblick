// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

enum AppEvent {
  APP_INIT = "Studio: App Initialized",

  // Dialog events
  DIALOG_SELECT_VIEW = "Studio: Dialog View Selected",
  DIALOG_CLOSE = "Studio: Dialog Closed",
  DIALOG_CLICK_CTA = "Studio: Dialog CTA Clicked",

  // App Bar events
  APP_BAR_CLICK_CTA = "Studio: App Bar CTA CLicked",

  // Tour events
  TOUR_PROMPT_SHOWN = "Studio: New UI Tour prompt shown",
  TOUR_STARTED = "Studio: New UI Tour started",
  TOUR_BACK = "Studio: New UI Tour step back",
  TOUR_NEXT = "Studio: New UI Tour step next",
  TOUR_COMPLETED = "Studio: New UI Tour completed",
  TOUR_DISMISSED = "Studio: New UI Tour dismissed",

  // App Menu events
  APP_MENU_CLICK = "Studio: App Menu Clicked",

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

  // Image events
  IMAGE_DOWNLOAD = "Studio: Image Downloaded",

  // Extension events
  EXTENSION_INSTALL = "Studio: Extension Installed",
  EXTENSION_UNINSTALL = "Studio: Extension Uninstalled",

  // Experimental features
  EXPERIMENTAL_FEATURE_TOGGLE = "Studio: Experimental Feature Toggled",

  // User engagement
  USER_OBSERVATION = "Studio: User Makes Observation",
  USER_ACTIVATION = "Studio: User Activated",
}

interface IAnalytics {
  logEvent(event: AppEvent, data?: { [key: string]: unknown }): void | Promise<void>;
}

export { AppEvent };
export default IAnalytics;
