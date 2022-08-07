// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Tooltip, Typography } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import { useMemoryInfo } from "@foxglove/studio-base/hooks";

const useStyles = makeStyles()((theme) => ({
  root: {
    width: "100%",
    position: "relative",
    textAlign: "left",
    padding: theme.spacing(1),
  },
}));

function toMB(bytes: number): number {
  return bytes / 1024 / 1024;
}

function MemoryUseIndicator(): JSX.Element {
  const memoryInfo = useMemoryInfo({ refreshIntervalMs: 5000 });
  const { classes } = useStyles();

  // If we can't load memory info (maybe not supported) then we don't show any indicator
  if (!memoryInfo) {
    return <></>;
  }

  const usedPercent = (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;
  const usedMb = toMB(memoryInfo.usedJSHeapSize).toLocaleString();
  const limitMb = toMB(memoryInfo.jsHeapSizeLimit).toLocaleString();

  return (
    <Tooltip title={`Used (MB): ${usedMb} / ${limitMb}`}>
      <div className={classes.root}>
        <Typography component="div" variant="caption" style={{ fontWeight: "bold" }}>
          mem
        </Typography>
        <Typography component="div" variant="caption">
          {usedPercent.toFixed(2)}%
        </Typography>
      </div>
    </Tooltip>
  );
}

export { MemoryUseIndicator };
