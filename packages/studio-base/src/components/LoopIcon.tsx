// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SvgIcon, SvgIconProps } from "@mui/material";

export default function LoopIcon(props: { strokeWidth: number } & SvgIconProps): JSX.Element {
  const { strokeWidth = 1, ...rest } = props;
  return (
    <SvgIcon {...rest}>
      <g fill="currentColor">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          d="M12.808,6l-4.621,-0c-3.312,-0 -6,2.689 -6,6c-0,3.311 2.688,6 6,6"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.692,3.879l2.121,2.121l-2.121,2.121"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="butt"
          d="M11.192,18l4.621,-0c3.312,-0 6,-2.689 6,-6c0,-3.311 -2.688,-6 -6,-6"
        />
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M13.308,20.121l-2.121,-2.121l2.121,-2.121"
        />
      </g>
    </SvgIcon>
  );
}
