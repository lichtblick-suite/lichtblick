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

export default function BlockheadFilledIcon({ className }: { className?: string }): JSX.Element {
  const classes = useStyles();

  return (
    <span className={cx(classes.root, className)}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <rect
          x="7.97"
          y="4.87"
          width="8.05"
          height="8.05"
          rx="2.34"
          strokeWidth="1.3"
          fill="currentColor"
        />
        <circle cx="12" cy="12" r="11.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path
          d="M4.78,21a11.5,11.5,0,0,0,14.44,0h0L17,17.44a2.31,2.31,0,0,0-1.87-1H8.87a2.31,2.31,0,0,0-1.87,1L4.78,21Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="1.3"
        />
      </svg>
    </span>
  );
}
