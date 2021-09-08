// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles } from "@fluentui/react";
import cx from "classnames";

const useStyles = makeStyles({
  // trying to match the wrapper provided by @fluentui here
  root: {
    display: "inline-block",
    verticalAlign: "top",
    speak: "none",
    width: "1em",
    height: "1em",
  },
});

export default function BlockheadIcon({ className }: { className?: string }): JSX.Element {
  const classes = useStyles();

  return (
    <span className={cx(classes.root, className)}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <g stroke="currentColor">
          <path
            d="M4.78,21,7,17.44a2.31,2.31,0,0,1,1.87-1h6.26a2.31,2.31,0,0,1,1.87,1L19.22,21"
            fill="none"
            strokeWidth="1.3"
          />
          <rect
            x="7.97"
            y="4.87"
            width="8.05"
            height="8.05"
            rx="2.34"
            fill="none"
            strokeWidth="1.3"
          />
          <circle cx="12" cy="12" r="11.5" strokeWidth="1.3" fill="none" />
        </g>
      </svg>
    </span>
  );
}
