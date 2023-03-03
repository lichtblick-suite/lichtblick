// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Add24Regular,
  AppsAddIn24Regular,
  BarcodeScanner24Regular,
  BookStar24Regular,
  BracesVariable24Regular,
  Delete24Regular,
  Dismiss24Regular,
  DismissCircle24Regular,
  Document24Regular,
  DocumentLink24Regular,
  Edit24Regular,
  Flow16Regular,
  GridDots24Filled,
  Settings20Regular,
  SlideAdd24Regular,
  TextBulletListLtr24Regular,
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
  Add: <Add24Regular />,
  AddIn: <AppsAddIn24Regular />,
  BacklogList: <TextBulletListLtr24Regular />,
  Blockhead: <BlockheadIcon />,
  BlockheadFilled: <BlockheadFilledIcon />,
  BookStar: <BookStar24Regular />,
  Cancel: <Dismiss24Regular />,
  DatabaseSettings: <DatabaseSettings />,
  Delete: <Delete24Regular />,
  Edit: <Edit24Regular />,
  ErrorBadge: <DismissCircle24Regular />,
  FileASPX: <DocumentLink24Regular />,
  FiveTileGrid: <PanelLayout />,
  Flow: <Flow16Regular />,
  GenericScan: <BarcodeScanner24Regular />,
  OpenFile: <Document24Regular />,
  PanelSettings: <PanelSettings />,
  RectangularClipping: <SlideAdd24Regular />,
  Settings: <Settings20Regular />,
  Variable2: <BracesVariable24Regular />,
  ROS: <GridDots24Filled />,
};

export default icons;
