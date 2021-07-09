// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import {
  CommandBarButton,
  IContextualMenuProps,
  IIconProps,
  Stack,
  useTheme,
} from "@fluentui/react";
import { useCallback } from "react";

import { useTooltip } from "@foxglove/studio-base/components/Tooltip";

export const BUTTON_SIZE = 50;
export const ICON_SIZE = 24;
export const FADED_OPACITY = 0.7;

export default function SidebarButton({
  dataSidebarKey,
  selected,
  title,
  iconProps,
  onClick,
  menuProps,
}: {
  dataSidebarKey: string; // for storybook
  selected: boolean;
  title: string;
  iconProps?: IIconProps;
  onClick?: () => void;
  menuProps?: IContextualMenuProps;
}): JSX.Element {
  const theme = useTheme();
  const { ref: tooltipRef, tooltip } = useTooltip({ contents: title, placement: "right" });
  const renderStack = useCallback(
    (props: React.HTMLAttributes<HTMLElement>) => <div {...props} ref={tooltipRef} />,
    [tooltipRef],
  );

  return (
    <Stack style={{ position: "relative", flexGrow: 1 }} as={renderStack}>
      {tooltip}
      <CommandBarButton
        data-sidebar-key={dataSidebarKey}
        style={{ height: BUTTON_SIZE, margin: 0 }}
        iconProps={{
          styles: {
            root: {
              opacity: selected ? 1 : FADED_OPACITY,
              fontSize: ICON_SIZE,
              height: ICON_SIZE,
              lineHeight: ICON_SIZE,
              "& span": { verticalAlign: "baseline" },
            },
          },
          ...iconProps,
        }}
        onClick={onClick}
        menuProps={menuProps}
        onRenderMenuIcon={() => ReactNull}
      />
      {selected && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: theme.palette.themePrimary,
          }}
        />
      )}
    </Stack>
  );
}
