// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SvgIcon, SvgIconProps } from "@mui/material";

export default function PublishPoseEstimateIcon(props: SvgIconProps): JSX.Element {
  return (
    <SvgIcon {...props}>
      <g>
        <path
          d="M.23,8.71l7.85,7.41L12,13.29l4,2.83,7.85-7.41S20.8,4,12,4,.23,8.71.23,8.71Z"
          opacity="0.2"
        />
        <circle cx="12.03" cy="18.5" r="2" />
        <path d="M13.28,13.15V5H17L12,0,7.08,5h3.7v8.2a5.5,5.5,0,1,0,2.5,0ZM12,22a3.5,3.5,0,1,1,3.5-3.5A3.5,3.5,0,0,1,12,22Z" />
        <path d="M16,16.12,14.6,14.67l1.46-1.37,1.37,1.45Zm2.18-2.06-1.37-1.45,1.45-1.37,1.37,1.45ZM20.34,12,19,10.55l1.45-1.37,1.38,1.45ZM22.52,10,21.15,8.49l1.31-1.24,1.37,1.46Z" />
        <path d="M8.08,16.12,6.63,14.75,8,13.3l1.46,1.37ZM5.9,14.06,4.45,12.69l1.37-1.45,1.45,1.37ZM3.72,12,2.27,10.63,3.64,9.18l1.45,1.37ZM1.54,10,.23,8.71,1.6,7.25,2.91,8.49Z" />
      </g>
    </SvgIcon>
  );
}
