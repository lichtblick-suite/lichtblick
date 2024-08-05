// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SvgIcon, SvgIconProps } from "@mui/material";

export default function PublishGoalIcon(props: SvgIconProps): JSX.Element {
  return (
    <SvgIcon {...props}>
      <g>
        <circle cx="12.03" cy="18.5" r="2" />
        <path d="M13.28,13.15V5H17L12,0,7.08,5h3.7v8.2a5.5,5.5,0,1,0,2.5,0ZM12,22a3.5,3.5,0,1,1,3.5-3.5A3.5,3.5,0,0,1,12,22Z" />
      </g>
    </SvgIcon>
  );
}
