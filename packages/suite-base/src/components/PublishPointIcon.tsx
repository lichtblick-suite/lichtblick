// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SvgIcon, SvgIconProps } from "@mui/material";

export default function PublishPointIcon(props: SvgIconProps): JSX.Element {
  return (
    <SvgIcon {...props}>
      <g>
        <circle cx="12" cy="12" r="2" />
        <path d="M12,17.5A5.5,5.5,0,1,1,17.5,12,5.51,5.51,0,0,1,12,17.5Zm0-9A3.5,3.5,0,1,0,15.5,12,3.5,3.5,0,0,0,12,8.5Z" />
      </g>
    </SvgIcon>
  );
}
