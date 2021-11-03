// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { ThemeProvider as FluentThemeProvider } from "@fluentui/react";
import {
  ArrowStepInLeft16Regular,
  ArrowStepInRight16Regular,
  Braces20Regular,
  Braces20Filled,
  CloudOff24Filled,
  Next20Filled,
  Next20Regular,
  Pause20Filled,
  Pause20Regular,
  Play20Filled,
  Play20Regular,
  Previous20Filled,
  Previous20Regular,
  Settings20Filled,
  Settings20Regular,
  ShapeSubtract20Regular,
  SplitHorizontal20Regular,
  SplitVertical20Regular,
  FullScreenMaximize20Regular,
  WeatherSunny20Regular,
  WeatherMoon20Filled,
  CircleHalfFill20Regular,
} from "@fluentui/react-icons";
import * as Icons from "@fluentui/react-icons-mdl2";
import { registerIcons, unregisterIcons } from "@fluentui/style-utilities";
import ArrowCollapseIcon from "@mdi/svg/svg/arrow-collapse.svg";
import ArrowLeftRightIcon from "@mdi/svg/svg/arrow-left-right.svg";
import ArrowLeftIcon from "@mdi/svg/svg/arrow-left.svg";
import ArrowRightIcon from "@mdi/svg/svg/arrow-right.svg";
import ArrowUpDownIcon from "@mdi/svg/svg/arrow-up-down.svg";
import BugIcon from "@mdi/svg/svg/bug.svg";
import CameraControlIcon from "@mdi/svg/svg/camera-control.svg";
import ArrowDownIcon from "@mdi/svg/svg/chevron-down.svg";
import ArrowUpIcon from "@mdi/svg/svg/chevron-up.svg";
import CloseIcon from "@mdi/svg/svg/close.svg";
import CogIcon from "@mdi/svg/svg/cog.svg";
import CrosshairsGpsIcon from "@mdi/svg/svg/crosshairs-gps.svg";
import CursorDefaultIcon from "@mdi/svg/svg/cursor-default.svg";
import DatabaseIcon from "@mdi/svg/svg/database.svg";
import DragIcon from "@mdi/svg/svg/drag.svg";
import FitToPageIcon from "@mdi/svg/svg/fit-to-page-outline.svg";
import HelpCircleIcon from "@mdi/svg/svg/help-circle-outline.svg";
import LayersIcon from "@mdi/svg/svg/layers.svg";
import SearchIcon from "@mdi/svg/svg/magnify.svg";
import MenuDownIcon from "@mdi/svg/svg/menu-down.svg";
import MenuLeftIcon from "@mdi/svg/svg/menu-left.svg";
import CompassOutlineIcon from "@mdi/svg/svg/navigation.svg";
import PencilIcon from "@mdi/svg/svg/pencil.svg";
import PinIcon from "@mdi/svg/svg/pin.svg";
import PlusCircleOutlineIcon from "@mdi/svg/svg/plus-circle-outline.svg";
import ServiceIcon from "@mdi/svg/svg/rectangle-outline.svg";
import TopicIcon from "@mdi/svg/svg/rhombus.svg";
import RulerIcon from "@mdi/svg/svg/ruler.svg";
import SwapHorizontalIcon from "@mdi/svg/svg/swap-horizontal.svg";
import SyncIcon from "@mdi/svg/svg/sync.svg";
import UnfoldLessIcon from "@mdi/svg/svg/unfold-less-horizontal.svg";
import UnfoldMoreIcon from "@mdi/svg/svg/unfold-more-horizontal.svg";
import Video3dIcon from "@mdi/svg/svg/video-3d.svg";
import { useLayoutEffect, useState } from "react";
import { ThemeProvider as StyledThemeProvider } from "styled-components";

import BlockheadFilledIcon from "@foxglove/studio-base/components/BlockheadFilledIcon";
import BlockheadIcon from "@foxglove/studio-base/components/BlockheadIcon";
import LoopIcon from "@foxglove/studio-base/components/LoopIcon";
import RosIcon from "@foxglove/studio-base/components/RosIcon";
import { darkTheme, lightTheme } from "@foxglove/studio-base/theme";

const icons: {
  // This makes it a type error to forget to add an icon here once it has been added to RegisteredIconNames.
  [N in RegisteredIconNames]: React.ReactElement;
} = {
  Add: <Icons.AddIcon />,
  AddIn: <Icons.AddInIcon />,
  ArrowCollapse: <ArrowCollapseIcon />,
  ArrowDown: <ArrowDownIcon />,
  ArrowLeft: <ArrowLeftIcon />,
  ArrowLeftRight: <ArrowLeftRightIcon />,
  ArrowRight: <ArrowRightIcon />,
  ArrowStepLeft: <ArrowStepInLeft16Regular />,
  ArrowStepRight: <ArrowStepInRight16Regular />,
  ArrowUp: <ArrowUpIcon />,
  ArrowUpDown: <ArrowUpDownIcon />,
  Blockhead: <BlockheadIcon />,
  BlockheadFilled: <BlockheadFilledIcon />,
  Braces: <Braces20Regular />,
  BracesFilled: <Braces20Filled />,
  Bug: <BugIcon />,
  CameraControl: <CameraControlIcon />,
  Cancel: <Icons.CancelIcon />,
  CaretSolidDown: <Icons.CaretSolidDownIcon />,
  CheckMark: <Icons.CheckMarkIcon />,
  ChevronDown: <Icons.ChevronDownIcon />,
  ChevronDownSmall: <Icons.ChevronDownSmallIcon />,
  ChevronLeft: <Icons.ChevronLeftIcon />,
  ChevronRight: <Icons.ChevronRightIcon />,
  ChevronUpSmall: <Icons.ChevronUpSmallIcon />,
  CircleHalfFill: <CircleHalfFill20Regular />,
  CirclePlus: <Icons.CirclePlusIcon />,
  Clear: <Icons.ClearIcon />,
  ClearSelection: <Icons.ClearSelectionIcon />,
  ClipboardList: <Icons.ClipboardListIcon />,
  Close: <CloseIcon />,
  CloudOffFilled: <CloudOff24Filled />,
  CodeEdit: <Icons.CodeEditIcon />,
  Cog: <CogIcon />,
  CompassOutline: <CompassOutlineIcon />,
  Contact: <Icons.ContactIcon />,
  Copy: <Icons.CopyIcon />,
  CrosshairsGps: <CrosshairsGpsIcon />,
  CursorDefault: <CursorDefaultIcon />,
  Database: <DatabaseIcon />,
  DataManagementSettings: <Icons.DataManagementSettingsIcon />,
  Delete: <Icons.DeleteIcon />,
  DependencyAdd: <Icons.DependencyAddIcon />,
  Download: <Icons.DownloadIcon />,
  DownloadDocument: <Icons.DownloadDocumentIcon />,
  Drag: <DragIcon />,
  Edit: <Icons.EditIcon />,
  Error: <Icons.ErrorIcon />,
  ErrorBadge: <Icons.ErrorBadgeIcon />,
  FileASPX: <Icons.FileASPXIcon />,
  FitToPage: <FitToPageIcon />,
  FiveTileGrid: <Icons.FiveTileGridIcon />,
  Flow: <Icons.FlowIcon />,
  FullScreenMaximize: <FullScreenMaximize20Regular />,
  GenericScan: <Icons.GenericScanIcon />,
  HelpCircle: <HelpCircleIcon />,
  Info: <Icons.InfoIcon />,
  Layers: <LayersIcon />,
  LocationDot: <Icons.LocationDotIcon />,
  Loop: <LoopIcon strokeWidth={1.375} />,
  LoopFilled: <LoopIcon strokeWidth={1.875} />,
  MenuDown: <MenuDownIcon />,
  MenuLeft: <MenuLeftIcon />,
  More: <Icons.MoreIcon />,
  MoreVertical: <Icons.MoreVerticalIcon />,
  Next: <Next20Regular />,
  NextFilled: <Next20Filled />,
  OpenFile: <Icons.OpenFileIcon />,
  OpenFolder: <Icons.OpenFolderHorizontalIcon />,
  Pause: <Pause20Regular />,
  PauseFilled: <Pause20Filled />,
  Pencil: <PencilIcon />,
  Pin: <PinIcon />,
  Play: <Play20Regular />,
  PlayFilled: <Play20Filled />,
  PlusCircleOutline: <PlusCircleOutlineIcon />,
  Previous: <Previous20Regular />,
  PreviousFilled: <Previous20Filled />,
  RectangularClipping: <Icons.RectangularClippingIcon />,
  Refresh: <Icons.RefreshIcon />,
  RemoveFromTrash: <Icons.RemoveFromTrashIcon />,
  Rename: <Icons.RenameIcon />,
  Ruler: <RulerIcon />,
  Search: <SearchIcon />,
  Service: <ServiceIcon />,
  Settings: <Settings20Regular />,
  SettingsFilled: <Settings20Filled />,
  Share: <Icons.ShareIcon />,
  ShapeSubtract: <ShapeSubtract20Regular />,
  SingleColumnEdit: <Icons.SingleColumnEditIcon />,
  SplitHorizontal: <SplitHorizontal20Regular />,
  SplitVertical: <SplitVertical20Regular />,
  StatusCircleInner: <Icons.StatusCircleInnerIcon />,
  SwapHorizontal: <SwapHorizontalIcon />,
  Sync: <SyncIcon />,
  TestBeakerSolid: <Icons.TestBeakerSolidIcon />,
  Topic: <TopicIcon />,
  Undo: <Icons.UndoIcon />,
  UnfoldLess: <UnfoldLessIcon />,
  UnfoldMore: <UnfoldMoreIcon />,
  Upload: <Icons.UploadIcon />,
  Variable2: <Icons.Variable2Icon />,
  Video3d: <Video3dIcon />,
  Warning: <Icons.WarningIcon />,
  WeatherSunny: <WeatherSunny20Regular />,
  WeatherMoon: <WeatherMoon20Filled />,
  "studio.ROS": <RosIcon />,
};

// By default the ThemeProvider adds an extra div to the DOM tree. We can disable this with a
// custom `as` component to FluentThemeProvider. The component must support a `ref` property
// otherwise we get react warnings.
const ThemeContainer = React.forwardRef((props, _ref) => <>{props.children}</>);
ThemeContainer.displayName = "ThemeContainer";

export default function ThemeProvider({
  children,
  isDark,
}: React.PropsWithChildren<{ isDark: boolean }>): React.ReactElement | ReactNull {
  // Icons need to be registered before other components are rendered. But we need to register them in an effect so that hot module reloading can run cleanups in the right order when the ThemeProvider is replaced. So we render nothing until after we've registered them.
  const [iconsRegistered, setIconsRegistered] = useState(false);
  useLayoutEffect(() => {
    if (iconsRegistered) {
      return () => unregisterIcons(Object.keys(icons));
    }
    registerIcons({ icons });
    setIconsRegistered(true);
    return undefined;
  }, [iconsRegistered]);

  if (!iconsRegistered) {
    return ReactNull;
  }

  const theme = isDark ? darkTheme : lightTheme;

  return (
    <FluentThemeProvider
      as={ThemeContainer}
      applyTo="none" // skip default global styles for now
      theme={theme}
    >
      <StyledThemeProvider
        // Expose the same theme to styled-components - see types/styled-components.d.ts for type definitions
        theme={theme}
      >
        {children}
      </StyledThemeProvider>
    </FluentThemeProvider>
  );
}
