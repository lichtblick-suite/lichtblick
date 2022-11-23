// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SvgIcon, SvgIconProps } from "@mui/material";

export default function RosIcon(props: SvgIconProps): JSX.Element {
  return (
    <SvgIcon {...props} viewBox="0 0 60 60">
      <g fill="currentColor">
        <circle cx={10} cy={10} r={6} />
        <circle cx={10} cy={30} r={6} />
        <circle cx={10} cy={50} r={6} />
        <circle cx={30} cy={10} r={6} />
        <circle cx={30} cy={30} r={6} />
        <circle cx={30} cy={50} r={6} />
        <circle cx={50} cy={10} r={6} />
        <circle cx={50} cy={30} r={6} />
        <circle cx={50} cy={50} r={6} />
      </g>
    </SvgIcon>
  );
}
