// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  BookStar24Regular,
  CircleHalfFill20Regular,
  Clipboard16Regular,
  FullScreenMaximize20Regular,
  QuestionCircle20Regular,
  Settings20Regular,
  ShapeSubtract20Regular,
  SplitHorizontal20Regular,
  SplitVertical20Regular,
  WeatherMoon20Filled,
  WeatherSunny20Regular,
} from "@fluentui/react-icons";
import {
  AddIcon,
  AddInIcon,
  BacklogListIcon,
  CancelIcon,
  CaretSolidDownIcon,
  CheckMarkIcon,
  ChevronDownIcon,
  ChevronDownSmallIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClearIcon,
  ClipboardListIcon,
  DeleteIcon,
  DoubleChevronDownIcon,
  DownloadIcon,
  EditIcon,
  ErrorBadgeIcon,
  FileASPXIcon,
  FiveTileGridIcon,
  FlowIcon,
  GenericScanIcon,
  InfoIcon,
  MoreVerticalIcon,
  OpenFileIcon,
  RectangularClippingIcon,
  Variable2Icon,
} from "@fluentui/react-icons-mdl2";
import CloseIcon from "@mdi/svg/svg/close.svg";
import SearchIcon from "@mdi/svg/svg/magnify.svg";
import MenuDownIcon from "@mdi/svg/svg/menu-down.svg";
import UnfoldLessIcon from "@mdi/svg/svg/unfold-less-horizontal.svg";
import UnfoldMoreIcon from "@mdi/svg/svg/unfold-more-horizontal.svg";

import BlockheadFilledIcon from "@foxglove/studio-base/components/BlockheadFilledIcon";
import BlockheadIcon from "@foxglove/studio-base/components/BlockheadIcon";
import RosIcon from "@foxglove/studio-base/components/RosIcon";
import { RegisteredIconNames } from "@foxglove/studio-base/types/Icons";

import DatabaseSettings from "../assets/database-settings.svg";
import PanelSettings from "../assets/panel-settings.svg";

const icons: {
  // This makes it a type error to forget to add an icon here once it has been added to RegisteredIconNames.
  [N in RegisteredIconNames]: React.ReactElement;
} = {
  Add: <AddIcon />,
  AddIn: <AddInIcon />,
  BacklogList: <BacklogListIcon />,
  Blockhead: <BlockheadIcon />,
  BlockheadFilled: <BlockheadFilledIcon />,
  BookStar: <BookStar24Regular />,
  Cancel: <CancelIcon />,
  CaretSolidDown: <CaretSolidDownIcon />,
  CheckMark: <CheckMarkIcon />,
  ChevronDown: <ChevronDownIcon />,
  ChevronDownSmall: <ChevronDownSmallIcon />,
  ChevronLeft: <ChevronLeftIcon />,
  ChevronRight: <ChevronRightIcon />,
  CircleHalfFill: <CircleHalfFill20Regular />,
  Clear: <ClearIcon />,
  Clipboard: <Clipboard16Regular />,
  ClipboardList: <ClipboardListIcon />,
  Close: <CloseIcon />,
  DatabaseSettings: <DatabaseSettings />,
  Delete: <DeleteIcon />,
  DoubleChevronDown: <DoubleChevronDownIcon />,
  Download: <DownloadIcon />,
  Edit: <EditIcon />,
  ErrorBadge: <ErrorBadgeIcon />,
  FileASPX: <FileASPXIcon />,
  FiveTileGrid: <FiveTileGridIcon />,
  Flow: <FlowIcon />,
  FullScreenMaximize: <FullScreenMaximize20Regular />,
  GenericScan: <GenericScanIcon />,
  Info: <InfoIcon />,
  MenuDown: <MenuDownIcon />,
  MoreVertical: <MoreVerticalIcon />,
  OpenFile: <OpenFileIcon />,
  PanelSettings: <PanelSettings />,
  QuestionCircle: <QuestionCircle20Regular />,
  RectangularClipping: <RectangularClippingIcon />,
  Search: <SearchIcon />,
  Settings: <Settings20Regular />,
  ShapeSubtract: <ShapeSubtract20Regular />,
  SplitHorizontal: <SplitHorizontal20Regular />,
  SplitVertical: <SplitVertical20Regular />,
  UnfoldLess: <UnfoldLessIcon />,
  UnfoldMore: <UnfoldMoreIcon />,
  Variable2: <Variable2Icon />,
  WeatherMoon: <WeatherMoon20Filled />,
  WeatherSunny: <WeatherSunny20Regular />,
  ROS: <RosIcon />,
};

export default icons;
