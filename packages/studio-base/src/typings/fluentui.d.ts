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
    | "ArrowCollapse"
    | "ArrowDown"
    | "ArrowLeft"
    | "ArrowLeftRight"
    | "ArrowRight"
    | "ArrowStepLeft"
    | "ArrowStepRight"
    | "ArrowUp"
    | "ArrowUpDown"
    | "Blockhead"
    | "BlockheadFilled"
    | "Braces"
    | "BracesFilled"
    | "Bug"
    | "CameraControl"
    | "Cancel"
    | "CaretSolidDown"
    | "CheckMark"
    | "ChevronDown"
    | "ChevronDownSmall"
    | "ChevronLeft"
    | "ChevronRight"
    | "ChevronUpSmall"
    | "CircleHalfFill"
    | "CirclePlus"
    | "Clear"
    | "ClearSelection"
    | "ClipboardList"
    | "Close"
    | "CloudOffFilled"
    | "CodeEdit"
    | "Cog"
    | "CompassOutline"
    | "Contact"
    | "Copy"
    | "CrosshairsGps"
    | "CursorDefault"
    | "Database"
    | "DataManagementSettings"
    | "Delete"
    | "DependencyAdd"
    | "Download"
    | "DownloadDocument"
    | "Drag"
    | "Edit"
    | "Error"
    | "ErrorBadge"
    | "FileASPX"
    | "FitToPage"
    | "FiveTileGrid"
    | "Flow"
    | "FullScreenMaximize"
    | "GenericScan"
    | "HelpCircle"
    | "Info"
    | "Layers"
    | "LocationDot"
    | "Loop"
    | "LoopFilled"
    | "MenuDown"
    | "MenuLeft"
    | "More"
    | "MoreVertical"
    | "NavigateExternalInline"
    | "Next"
    | "NextFilled"
    | "OpenFile"
    | "OpenFolder"
    | "Pause"
    | "PauseFilled"
    | "Pencil"
    | "Pin"
    | "Play"
    | "PlayFilled"
    | "PlusCircleOutline"
    | "Previous"
    | "PreviousFilled"
    | "QuestionCircle"
    | "RectangularClipping"
    | "Refresh"
    | "RemoveFromTrash"
    | "Rename"
    | "Ruler"
    | "Search"
    | "Service"
    | "Settings"
    | "SettingsFilled"
    | "Share"
    | "ShapeSubtract"
    | "SingleColumnEdit"
    | "SplitHorizontal"
    | "SplitVertical"
    | "StatusCircleInner"
    | "SwapHorizontal"
    | "Sync"
    | "TestBeakerSolid"
    | "Topic"
    | "Undo"
    | "UnfoldMore"
    | "UnfoldLess"
    | "Upload"
    | "Variable2"
    | "Video3d"
    | "Warning"
    | "WeatherSunny"
    | "WeatherMoon"
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
