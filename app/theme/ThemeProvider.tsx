// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import { ThemeProvider as FluentThemeProvider } from "@fluentui/react";
import * as Icons from "@fluentui/react-icons-mdl2";
import { registerIcons, unregisterIcons } from "@fluentui/style-utilities";
import { useLayoutEffect, useState } from "react";
import { ThemeProvider as StyledThemeProvider } from "styled-components";

import RosIcon from "@foxglove-studio/app/components/RosIcon";
import theme from "@foxglove-studio/app/theme";

const icons: {
  // This makes it a type error to forget to add an icon here once it has been added to RegisteredIconNames.
  [N in RegisteredIconNames]: React.ReactElement;
} = {
  Add: <Icons.AddIcon />,
  Cancel: <Icons.CancelIcon />,
  CheckMark: <Icons.CheckMarkIcon />,
  ChevronDown: <Icons.ChevronDownIcon />,
  ChevronRight: <Icons.ChevronRightIcon />,
  CirclePlus: <Icons.CirclePlusIcon />,
  Clear: <Icons.ClearIcon />,
  DataManagementSettings: <Icons.DataManagementSettingsIcon />,
  Delete: <Icons.DeleteIcon />,
  Edit: <Icons.EditIcon />,
  ErrorBadge: <Icons.ErrorBadgeIcon />,
  FileASPX: <Icons.FileASPXIcon />,
  FiveTileGrid: <Icons.FiveTileGridIcon />,
  Flow: <Icons.FlowIcon />,
  Info: <Icons.InfoIcon />,
  MoreVertical: <Icons.MoreVerticalIcon />,
  OpenFile: <Icons.OpenFileIcon />,
  Settings: <Icons.SettingsIcon />,
  Share: <Icons.ShareIcon />,
  TestBeakerSolid: <Icons.TestBeakerSolidIcon />,
  Variable2: <Icons.Variable2Icon />,
  "studio.ROS": <RosIcon />,
};

export default function ThemeProvider({
  children,
}: React.PropsWithChildren<unknown>): React.ReactElement | ReactNull {
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

  return (
    <FluentThemeProvider
      // By default the ThemeProvider adds an extra div to the DOM tree. We can disable this with a
      // custom `as` component, but we get React warnings if our component doesn't support ref.
      // eslint-disable-next-line react/display-name
      as={React.forwardRef((props, _ref) => props.children)}
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
