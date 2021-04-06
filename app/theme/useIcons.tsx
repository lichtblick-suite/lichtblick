// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import {
  AddIcon,
  CheckMarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CirclePlusIcon,
  DataManagementSettingsIcon,
  DeleteIcon,
  EditIcon,
  FileASPXIcon,
  FiveTileGridIcon,
  FlowIcon,
  MoreVerticalIcon,
  OpenFileIcon,
  SettingsIcon,
  ShareIcon,
  Variable2Icon,
} from "@fluentui/react-icons-mdl2";
import { registerIcons, unregisterIcons } from "@fluentui/style-utilities";
import { useLayoutEffect, useRef } from "react";

import RosIcon from "@foxglove-studio/app/components/RosIcon";

const iconComponents = [
  AddIcon,
  CheckMarkIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  CirclePlusIcon,
  DataManagementSettingsIcon,
  DeleteIcon,
  EditIcon,
  FileASPXIcon,
  FiveTileGridIcon,
  FlowIcon,
  MoreVerticalIcon,
  OpenFileIcon,
  SettingsIcon,
  ShareIcon,
  Variable2Icon,
];

const icons: Record<string, React.ReactElement> = {};
for (const Component of iconComponents) {
  const { displayName = "" } = Component;
  if (!displayName.endsWith("Icon")) {
    throw new Error("Names must end with Icon");
  }
  icons[displayName.replace(/Icon$/, "")] = <Component />;
}

icons["studio.ROS"] = <RosIcon />;

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
