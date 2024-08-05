// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SvgIcon, SvgIconProps } from "@mui/material";

export default function EventIcon(props: SvgIconProps): JSX.Element {
  return (
    <SvgIcon {...props}>
      <path d="M18.03,3.03H6.03c-.55,0-1,.45-1,1v3h0v9.42c0,.36,.18,.69,.5,.87l6.5,3.71,6.5-3.71c.31-.18,.5-.51,.5-.87V4.03c0-.55-.45-1-1-1Z" />
    </SvgIcon>
  );
}
