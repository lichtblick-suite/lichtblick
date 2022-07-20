// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
import {
  CommandBarButton,
  IButtonProps,
  IContextualMenuProps,
  IIconProps,
  IRenderFunction,
} from "@fluentui/react";
import { Box, useTheme } from "@mui/material";
import { useCallback } from "react";

import Stack from "@foxglove/studio-base/components/Stack";
import { useTooltip } from "@foxglove/studio-base/components/Tooltip";

import { Badge as StatusBadge } from "./Badge";
import { Badge } from "./types";

export const BUTTON_SIZE = 50;
export const ICON_SIZE = 24;
export const FADED_OPACITY = 0.7;

type SidebarButtonProps = {
  dataSidebarKey: string; // for storybook
  selected: boolean;
  title: string;
  iconProps?: IIconProps;
  onClick?: () => void;
  menuProps?: IContextualMenuProps;
  badge?: Badge;
};

export default function SidebarButton(props: SidebarButtonProps): JSX.Element {
  const { dataSidebarKey, selected, title, iconProps, onClick, menuProps, badge } = props;
  const theme = useTheme();

  const { ref: tooltipRef, tooltip } = useTooltip({ contents: title, placement: "right" });

  const renderIcon = useCallback(
    (buttonProps?: IButtonProps, defaultRender?: IRenderFunction<IButtonProps>) => {
      if (!defaultRender) {
        return <></>;
      }

      if (!badge) {
        return defaultRender(buttonProps);
      }

      return <StatusBadge count={badge.count}>{defaultRender(buttonProps)}</StatusBadge>;
    },
    [badge],
  );

  return (
    <Stack ref={tooltipRef} position="relative" flexGrow={1}>
      {tooltip}
      <CommandBarButton
        data-sidebar-key={dataSidebarKey}
        styles={{
          root: { height: BUTTON_SIZE, margin: 0, backgroundColor: "transparent" },
          icon: {
            opacity: selected ? 1 : FADED_OPACITY,
            fontSize: ICON_SIZE,
            height: ICON_SIZE,
            lineHeight: ICON_SIZE,

            svg: { fill: "currentColor", height: "1em", width: "1em" },
          },
        }}
        iconProps={iconProps}
        onClick={onClick}
        onRenderIcon={renderIcon}
        menuProps={menuProps}
        onRenderMenuIcon={() => ReactNull}
      />
      {selected && (
        <Box
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 3,
            backgroundColor: theme.palette.primary.main,
          }}
        />
      )}
    </Stack>
  );
}
