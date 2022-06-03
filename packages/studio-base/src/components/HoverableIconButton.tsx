// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, IconButtonProps } from "@mui/material";
import { forwardRef, useCallback, useEffect, useState } from "react";

type Props = {
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
} & Omit<IconButtonProps, "children">;

const HoverableIconButton = forwardRef<HTMLButtonElement, Props>((props, ref) => {
  const { icon, activeIcon } = props;

  const [hovered, setHovered] = useState(false);

  const onMouseOver = useCallback(() => {
    if (props.disabled === true) {
      return;
    }
    setHovered(true);
  }, [props.disabled]);

  const onMouseLeave = useCallback(() => {
    setHovered(false);
  }, []);

  useEffect(() => {
    if (props.disabled === true) {
      setHovered(false);
    }
  }, [props.disabled]);

  return (
    <IconButton
      ref={ref}
      {...props}
      component="button"
      onMouseEnter={onMouseOver}
      onMouseLeave={onMouseLeave}
    >
      {activeIcon != undefined ? (hovered ? activeIcon : icon) : icon}
    </IconButton>
  );
});

HoverableIconButton.displayName = "HoverableIconButton";

export default HoverableIconButton;
