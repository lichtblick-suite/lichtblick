// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()({
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
  const { classes, cx } = useStyles();

  return (
    <span className={cx(classes.root, className)}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <g fill="currentColor">
          <rect x="8.07" y="5.38" width="7.87" height="7.87" rx="2" />
          <path d="M12,1.53A10.5,10.5,0,1,0,22.5,12,10.51,10.51,0,0,0,12,1.53ZM18.41,19l-1.67-2.61a2.47,2.47,0,0,0-2-1H9.26a2.48,2.48,0,0,0-2,1L5.59,19a9.5,9.5,0,1,1,12.82,0Z" />
        </g>
      </svg>
    </span>
  );
}
