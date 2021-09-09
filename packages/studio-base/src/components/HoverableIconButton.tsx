// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, IButtonProps, IIconProps } from "@fluentui/react";
import { forwardRef, useCallback, useEffect, useState } from "react";

type Props = {
  iconProps: {
    iconNameActive?: RegisteredIconNames | undefined;
  } & IIconProps;
} & Omit<IButtonProps, "allowDisabledFocus">;

const HoverableIconButton = forwardRef<HTMLElement, Props>((props, ref) => {
  const {
    iconProps: { iconName, iconNameActive, ...restIcon },
    ...restProps
  } = props;

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
      elementRef={ref}
      {...restProps}
      iconProps={{
        ...restIcon,
        iconName: iconNameActive != undefined ? (hovered ? iconNameActive : iconName) : iconName,
      }}
      allowDisabledFocus={true /* required to support mouse leave events for disabled buttons */}
      onMouseEnter={onMouseOver}
      onMouseLeave={onMouseLeave}
    />
  );
});
HoverableIconButton.displayName = "HoverableIconButton";

export default HoverableIconButton;
