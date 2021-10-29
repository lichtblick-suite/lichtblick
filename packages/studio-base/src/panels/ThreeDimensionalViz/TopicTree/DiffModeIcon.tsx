// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { colors } from "@foxglove/studio-base/util/sharedStyleConstants";

export default function DiffModeIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      version="1.1"
      height={24}
      width={24}
      viewBox="0 0 300 200"
    >
      <defs>
        <circle r="100" id="circle_left" cy="100" cx="100" />
        <circle r="100" id="circle_right" cy="100" cx="200" />
        <mask id="mask_left">
          <use xlinkHref="#circle_right" fill="white" />
        </mask>
      </defs>
      <g>
        <use
          xlinkHref="#circle_left"
          strokeWidth="1.5"
          stroke="none"
          fill={colors.DIFF_MODE_SOURCE_1}
        />
        <use
          xlinkHref="#circle_right"
          strokeWidth="1.5"
          stroke="none"
          fill={colors.DIFF_MODE_SOURCE_2}
        />
        <use
          xlinkHref="#circle_left"
          id="center"
          fill={colors.DIFF_MODE_SOURCE_BOTH}
          mask="url(#mask_left)"
        />
      </g>
    </svg>
  );
}
