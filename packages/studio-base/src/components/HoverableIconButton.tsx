// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { IconButton, IButtonProps, IIconProps } from "@fluentui/react";
import { useState } from "react";

type Props = {
  iconProps: {
    iconNameActive?: RegisteredIconNames | undefined;
  } & IIconProps;
} & IButtonProps;

export default function HoverableIconButton({
  iconProps: { iconName, iconNameActive, ...rest },
  ...props
}: Props): JSX.Element {
  const [hovered, setHovered] = useState(false);

  return (
    <IconButton
      {...props}
      iconProps={{
        iconName: iconNameActive != undefined ? (hovered ? iconNameActive : iconName) : iconName,
        ...rest,
      }}
      {...(props.disabled !== true && {
        onMouseOver: () => setHovered(true),
        onMouseLeave: () => setHovered(false),
      })}
    />
  );
}
