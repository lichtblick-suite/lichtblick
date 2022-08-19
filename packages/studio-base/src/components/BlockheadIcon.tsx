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

export default function BlockheadIcon({ className }: { className?: string }): JSX.Element {
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
          <path d="M22.5,12A10.5,10.5,0,1,0,5.08,19.87l0,0,.35.28a10,10,0,0,0,1.55,1l.24.12.6.29.4.16.48.17.45.14.48.13c.15,0,.3.07.46.09a5,5,0,0,0,.56.09l.39.05c.32,0,.65.05,1,.05s.66,0,1-.05l.39-.05a5,5,0,0,0,.56-.09,3.41,3.41,0,0,0,.46-.1,3.59,3.59,0,0,0,.47-.12l.47-.14.46-.17.42-.17.55-.26.29-.15a9.84,9.84,0,0,0,1.54-1l.35-.28,0,0A10.44,10.44,0,0,0,22.5,12Zm-5.12,7.82-.15.11-.58.34-.2.12-.61.29a1,1,0,0,1-.18.08,6.77,6.77,0,0,1-.75.28l-.35.1-.48.12-.37.08-.53.08-.31,0c-.29,0-.58,0-.87,0s-.58,0-.87,0l-.31,0-.53-.08-.37-.08-.48-.12L9.09,21a6.77,6.77,0,0,1-.75-.28,1,1,0,0,1-.18-.08l-.61-.29-.2-.12c-.2-.11-.39-.22-.58-.35l-.15-.1-.22-.17L8.06,17a1.51,1.51,0,0,1,1.22-.62h5.44a1.51,1.51,0,0,1,1.21.6l1.67,2.65A1.84,1.84,0,0,1,17.38,19.82Zm-.63-3.38a2.49,2.49,0,0,0-2-1H9.28a2.5,2.5,0,0,0-2,1.07L5.62,19a9.5,9.5,0,1,1,12.76,0Z" />
          <path d="M14,5.36h-3.9a2,2,0,0,0-2,2v3.9a2,2,0,0,0,2,2H14a2,2,0,0,0,2-2V7.36A2,2,0,0,0,14,5.36Zm1,5.9a1,1,0,0,1-1,1h-3.9a1,1,0,0,1-1-1V7.36a1,1,0,0,1,1-1H14a1,1,0,0,1,1,1Z" />
        </g>
      </svg>
    </span>
  );
}
