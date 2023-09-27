// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Add20Regular,
  AppsAddIn20Regular,
  BarcodeScanner20Regular,
  BookStar20Regular,
  BracesVariable20Regular,
  Delete20Regular,
  Dismiss20Regular,
  DismissCircle20Regular,
  Document20Regular,
  DocumentLink20Regular,
  Edit20Regular,
  Flow20Regular,
  GridDots20Filled,
  Settings20Regular,
  SlideAdd20Regular,
  Sparkle20Regular,
  TextBulletListLtr20Regular,
} from "@fluentui/react-icons";

import BlockheadFilledIcon from "@foxglove/studio-base/components/BlockheadFilledIcon";
import BlockheadIcon from "@foxglove/studio-base/components/BlockheadIcon";
import { RegisteredIconNames } from "@foxglove/studio-base/types/Icons";

import DatabaseSettings from "../assets/database-settings.svg";
import PanelLayout from "../assets/panel-layout.svg";
import PanelSettings from "../assets/panel-settings.svg";

const icons: {
  // This makes it a type error to forget to add an icon here once it has been added to RegisteredIconNames.
  [N in RegisteredIconNames]: React.ReactElement;
} = {
  Add: <Add20Regular />,
  AddIn: <AppsAddIn20Regular />,
  BacklogList: <TextBulletListLtr20Regular />,
  Blockhead: <BlockheadIcon />,
  BlockheadFilled: <BlockheadFilledIcon />,
  BookStar: <BookStar20Regular />,
  Cancel: <Dismiss20Regular />,
  DatabaseSettings: <DatabaseSettings />,
  Delete: <Delete20Regular />,
  Edit: <Edit20Regular />,
  ErrorBadge: <DismissCircle20Regular />,
  FileASPX: <DocumentLink20Regular />,
  FiveTileGrid: <PanelLayout />,
  Flow: <Flow20Regular />,
  GenericScan: <BarcodeScanner20Regular />,
  OpenFile: <Document20Regular />,
  PanelSettings: <PanelSettings />,
  RectangularClipping: <SlideAdd20Regular />,
  Settings: <Settings20Regular />,
  Sparkle: <Sparkle20Regular />,
  Variable2: <BracesVariable20Regular />,
  ROS: <GridDots20Filled />,
};

export default icons;
