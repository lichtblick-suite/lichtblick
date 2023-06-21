// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Tooltip, Typography } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import { useMemoryInfo } from "@foxglove/hooks";
import { AppSetting } from "@foxglove/studio-base/AppSetting";
import { useAppConfigurationValue } from "@foxglove/studio-base/hooks";

const useStyles = makeStyles()((theme) => ({
  root: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
    position: "relative",
    width: 50,
    flex: "1 0 50px",
    fontSize: theme.typography.caption.fontSize,
    overflow: "hidden",
  },
  label: {
    fontWeight: "bold",
  },
  text: {
    lineHeight: 1.1,
  },
}));

function toMB(bytes: number): number {
  return bytes / 1024 / 1024;
}

function MemoryUseIndicator(): JSX.Element {
  const memoryInfo = useMemoryInfo({ refreshIntervalMs: 5000 });
  const { classes, cx } = useStyles();
  const [enableNewTopNav = true] = useAppConfigurationValue<boolean>(AppSetting.ENABLE_NEW_TOPNAV);

  // If we can't load memory info (maybe not supported) then we don't show any indicator
  if (!memoryInfo) {
    return <></>;
  }

  const usedPercent = (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100;
  const usedMb = toMB(memoryInfo.usedJSHeapSize).toLocaleString();
  const limitMb = toMB(memoryInfo.jsHeapSizeLimit).toLocaleString();

  return (
    <Tooltip
      arrow={false}
      title={`Used (MB): ${usedMb} / ${limitMb}`}
      placement={enableNewTopNav ? "bottom" : "right"}
    >
      <div className={classes.root}>
        <Typography className={cx(classes.label, classes.text)} variant="caption">
          MEM
        </Typography>
        <Typography className={classes.text} variant="caption">
          {usedPercent.toFixed(2)}%
        </Typography>
      </div>
    </Tooltip>
  );
}

export { MemoryUseIndicator };
