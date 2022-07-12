// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  ArrowStepInLeft16Regular,
  ArrowStepInRight16Regular,
  BookStar24Regular,
  Braces20Filled,
  Braces20Regular,
  CircleHalfFill20Regular,
  Clipboard16Regular,
  CloudOff24Filled,
  FullScreenMaximize20Regular,
  Next20Filled,
  Next20Regular,
  Pause20Filled,
  Pause20Regular,
  Play20Filled,
  Play20Regular,
  Previous20Filled,
  Previous20Regular,
  QuestionCircle20Regular,
  Settings20Filled,
  Settings20Regular,
  ShapeSubtract20Regular,
  SplitHorizontal20Regular,
  SplitVertical20Regular,
  WeatherMoon20Filled,
  WeatherSunny20Regular,
} from "@fluentui/react-icons";
import * as Icons from "@fluentui/react-icons-mdl2";
import ArrowCollapseUpIcon from "@mdi/svg/svg/arrow-collapse-up.svg";
import ArrowCollapseIcon from "@mdi/svg/svg/arrow-collapse.svg";
import ArrowExpandUpIcon from "@mdi/svg/svg/arrow-expand-up.svg";
import ArrowLeftRightIcon from "@mdi/svg/svg/arrow-left-right.svg";
import ArrowLeftIcon from "@mdi/svg/svg/arrow-left.svg";
import ArrowRightIcon from "@mdi/svg/svg/arrow-right.svg";
import ArrowUpDownIcon from "@mdi/svg/svg/arrow-up-down.svg";
import BugIcon from "@mdi/svg/svg/bug.svg";
import CameraControlIcon from "@mdi/svg/svg/camera-control.svg";
import ArrowDownIcon from "@mdi/svg/svg/chevron-down.svg";
import ArrowUpIcon from "@mdi/svg/svg/chevron-up.svg";
import ClockOutlineIcon from "@mdi/svg/svg/clock-outline.svg";
import CloseIcon from "@mdi/svg/svg/close.svg";
import CogIcon from "@mdi/svg/svg/cog.svg";
import CrosshairsGpsIcon from "@mdi/svg/svg/crosshairs-gps.svg";
import CursorDefaultIcon from "@mdi/svg/svg/cursor-default.svg";
import DatabaseIcon from "@mdi/svg/svg/database.svg";
import DragIcon from "@mdi/svg/svg/drag.svg";
import FitToPageIcon from "@mdi/svg/svg/fit-to-page-outline.svg";
import HelpCircleIcon from "@mdi/svg/svg/help-circle-outline.svg";
import HelpCircleFilledIcon from "@mdi/svg/svg/help-circle.svg";
import LayersIcon from "@mdi/svg/svg/layers.svg";
import SearchIcon from "@mdi/svg/svg/magnify.svg";
import MapMarkerIcon from "@mdi/svg/svg/map-marker.svg";
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

import BlockheadFilledIcon from "@foxglove/studio-base/components/BlockheadFilledIcon";
import BlockheadIcon from "@foxglove/studio-base/components/BlockheadIcon";
import LoopIcon from "@foxglove/studio-base/components/LoopIcon";
import RosIcon from "@foxglove/studio-base/components/RosIcon";

import DatabaseSettings from "../assets/database-settings.svg";
import PanelSettings from "../assets/panel-settings.svg";

const icons: {
  // This makes it a type error to forget to add an icon here once it has been added to RegisteredIconNames.
  [N in RegisteredIconNames]: React.ReactElement;
} = {
  Add: <Icons.AddIcon />,
  AddIn: <Icons.AddInIcon />,
  ArrowCollapse: <ArrowCollapseIcon />,
  ArrowCollapseUp: <ArrowCollapseUpIcon />,
  ArrowDown: <ArrowDownIcon />,
  ArrowExpandUp: <ArrowExpandUpIcon />,
  ArrowLeft: <ArrowLeftIcon />,
  ArrowLeftRight: <ArrowLeftRightIcon />,
  ArrowRight: <ArrowRightIcon />,
  ArrowStepLeft: <ArrowStepInLeft16Regular />,
  ArrowStepRight: <ArrowStepInRight16Regular />,
  ArrowUp: <ArrowUpIcon />,
  ArrowUpDown: <ArrowUpDownIcon />,
  Blockhead: <BlockheadIcon />,
  BlockheadFilled: <BlockheadFilledIcon />,
  BookStar: <BookStar24Regular />,
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
  Clipboard: <Clipboard16Regular />,
  ClipboardList: <Icons.ClipboardListIcon />,
  ClockOutline: <ClockOutlineIcon />,
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
  DatabaseSettings: <DatabaseSettings />,
  Delete: <Icons.DeleteIcon />,
  DependencyAdd: <Icons.DependencyAddIcon />,
  DoubleChevronDown: <Icons.DoubleChevronDownIcon />,
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
  HelpCircleFilled: <HelpCircleFilledIcon />,
  Info: <Icons.InfoIcon />,
  Layers: <LayersIcon />,
  LocationDot: <Icons.LocationDotIcon />,
  Loop: <LoopIcon strokeWidth={1.375} />,
  LoopFilled: <LoopIcon strokeWidth={1.875} />,
  MapMarker: <MapMarkerIcon />,
  MenuDown: <MenuDownIcon />,
  MenuLeft: <MenuLeftIcon />,
  More: <Icons.MoreIcon />,
  MoreVertical: <Icons.MoreVerticalIcon />,
  NavigateExternalInline: <Icons.NavigateExternalInlineIcon />,
  Next: <Next20Regular />,
  NextFilled: <Next20Filled />,
  OpenFile: <Icons.OpenFileIcon />,
  OpenFolder: <Icons.OpenFolderHorizontalIcon />,
  PanelSettings: <PanelSettings />,
  Pause: <Pause20Regular />,
  PauseFilled: <Pause20Filled />,
  Pencil: <PencilIcon />,
  Pin: <PinIcon />,
  Play: <Play20Regular />,
  PlayFilled: <Play20Filled />,
  PlusCircleOutline: <PlusCircleOutlineIcon />,
  Previous: <Previous20Regular />,
  PreviousFilled: <Previous20Filled />,
  QuestionCircle: <QuestionCircle20Regular />,
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

export default icons;
