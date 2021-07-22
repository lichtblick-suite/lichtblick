// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IStyleFunctionOrObject, IIconStyleProps, IIconStyles } from "@fluentui/react";

// Restrict TS types for icons to allow only the icon names we've registered.
declare global {
  type CustomIconNames = "studio.ROS";
  type RegisteredIconNames =
    | CustomIconNames
    | "Add"
    | "AddIn"
    | "Cancel"
    | "CheckMark"
    | "ChevronDown"
    | "ChevronDownSmall"
    | "ChevronLeft"
    | "ChevronRight"
    | "ChevronUpSmall"
    | "CirclePlus"
    | "Clear"
    | "ClearSelection"
    | "ClipboardList"
    | "CodeEdit"
    | "Contact"
    | "Copy"
    | "DataManagementSettings"
    | "Delete"
    | "DownloadDocument"
    | "Download"
    | "Edit"
    | "Error"
    | "ErrorBadge"
    | "FileASPX"
    | "FiveTileGrid"
    | "Flow"
    | "GenericScan"
    | "Info"
    | "Loop"
    | "LoopFilled"
    | "More"
    | "MoreVertical"
    | "Next"
    | "NextFilled"
    | "OpenFile"
    | "OpenFolder"
    | "Pause"
    | "PauseFilled"
    | "Play"
    | "PlayFilled"
    | "Previous"
    | "PreviousFilled"
    | "RectangularClipping"
    | "Rename"
    | "Settings"
    | "Share"
    | "SingleColumnEdit"
    | "TestBeakerSolid"
    | "Upload"
    | "Variable2"
    | "Warning"
    | never; // never has no effect here other than keeping the semicolon on a separate line for easier conflict resolution
}

declare module "@fluentui/react/lib/components/Icon" {
  export interface IIconProps {
    iconName?: RegisteredIconNames;
    styles?: IStyleFunctionOrObject<IIconStyleProps, IIconStyles>;
  }
}
declare module "@fluentui/react/lib/Icon" {
  export interface IIconProps {
    iconName?: RegisteredIconNames;
    styles?: IStyleFunctionOrObject<IIconStyleProps, IIconStyles>;
  }
}
declare module "@fluentui/react" {
  export interface IIconProps {
    iconName?: RegisteredIconNames;
    styles?: IStyleFunctionOrObject<IIconStyleProps, IIconStyles>;
  }
}
