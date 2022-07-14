// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, IconButtonProps } from "@mui/material";
import { forwardRef, useCallback, useEffect, useState } from "react";

type Props = {
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  color?: IconButtonProps["color"];
  activeColor?: IconButtonProps["color"];
} & Omit<IconButtonProps, "children" | "color">;

const HoverableIconButton = forwardRef<HTMLButtonElement, Props>((props, ref) => {
  const { icon, activeIcon, color, activeColor, onMouseLeave, onMouseEnter, ...rest } = props;

  const [hovered, setHovered] = useState(false);

  const handleMouseEnter = useCallback(
    (event) => {
      if (onMouseEnter != undefined) {
        onMouseEnter(event);
      }
      if (props.disabled === true) {
        return;
      }
      setHovered(true);
    },
    [onMouseEnter, props.disabled],
  );

  const handleMouseLeave = useCallback(
    (event) => {
      if (onMouseLeave != undefined) {
        onMouseLeave(event);
      }
      setHovered(false);
    },
    [onMouseLeave],
  );

  useEffect(() => {
    if (props.disabled === true) {
      setHovered(false);
    }
  }, [props.disabled]);

  return (
    <IconButton
      ref={ref}
      {...rest}
      component="button"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      color={activeColor != undefined ? (hovered ? activeColor : color) : color}
    >
      {activeIcon != undefined ? (hovered ? activeIcon : icon) : icon}
    </IconButton>
  );
});

HoverableIconButton.displayName = "HoverableIconButton";

export default HoverableIconButton;
