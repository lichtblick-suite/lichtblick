// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import * as Icons from "@fluentui/react-icons-mdl2";
import { registerIcons, unregisterIcons } from "@fluentui/style-utilities";
import { useLayoutEffect, useRef } from "react";

import RosIcon from "@foxglove-studio/app/components/RosIcon";

const icons: {
  // This makes it a type error to forget to add an icon here once it has been added to RegisteredIconNames.
  [N in RegisteredIconNames]: React.ReactElement;
} = {
  Add: <Icons.AddIcon />,
  CheckMark: <Icons.CheckMarkIcon />,
  ChevronDown: <Icons.ChevronDownIcon />,
  ChevronRight: <Icons.ChevronRightIcon />,
  CirclePlus: <Icons.CirclePlusIcon />,
  DataManagementSettings: <Icons.DataManagementSettingsIcon />,
  Delete: <Icons.DeleteIcon />,
  Edit: <Icons.EditIcon />,
  FileASPX: <Icons.FileASPXIcon />,
  FiveTileGrid: <Icons.FiveTileGridIcon />,
  Flow: <Icons.FlowIcon />,
  MoreVertical: <Icons.MoreVerticalIcon />,
  OpenFile: <Icons.OpenFileIcon />,
  Settings: <Icons.SettingsIcon />,
  Share: <Icons.ShareIcon />,
  Variable2: <Icons.Variable2Icon />,
  "studio.ROS": <RosIcon />,
};

export default function useIcons(): void {
  const registered = useRef(false);
  if (!registered.current) {
    // Need to register before render to avoid warnings from icon components.
    registerIcons({ icons });
    registered.current = true;
  }
  useLayoutEffect(() => {
    return () => {
      if (registered.current) {
        unregisterIcons(Object.keys(icons));
      }
    };
  }, []);
}
