// SPDX-FileCopyrightText: Copyright (C) 2023-2024 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Dismiss20Filled, Warning24Filled } from "@fluentui/react-icons";
import {
  Button,
  IconButton,
  Link,
  ThemeProvider as MuiThemeProvider,
  Portal,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@lichtblick/suite-base/components/Stack";
import { createMuiTheme } from "@lichtblick/theme";

const MINIMUM_CHROME_VERSION = 76;
const MINIMUM_SAFARI_VERSION = 13;
const MINIMUM_FIREFOX_VERSION = 70;
const BANNER_HEIGHT = 54;
const BANNER_MOBILE_HEIGHT = 100;

const useStyles = makeStyles<void, "button" | "icon">()((theme, _params, classes) => ({
  root: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    minHeight: BANNER_HEIGHT,
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    boxSizing: "border-box",
    padding: theme.spacing(1, 1.5),
    zIndex: theme.zIndex.modal + 1,
    gap: theme.spacing(1),
    position: "fixed",
    top: 0,
    right: 0,
    left: 0,

    [theme.breakpoints.down("md")]: {
      [`.${classes.icon}`]: {
        display: "none",
      },
    },
    [theme.breakpoints.down("sm")]: {
      height: BANNER_MOBILE_HEIGHT,

      [`.${classes.button}`]: {
        display: "none",
      },
    },
  },
  fullscreen: {
    flexDirection: "column",
    bottom: 0,
    minHeight: "100vh",
    justifyContent: "center",
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    textAlign: "center",
  },
  icon: {
    color: theme.palette.primary.dark,
  },
  button: {
    whiteSpace: "nowrap",
  },
  spacer: {
    height: BANNER_HEIGHT,
    flex: "none",

    [theme.breakpoints.down("sm")]: {
      minHeight: BANNER_MOBILE_HEIGHT,
    },
  },
}));

function CompatibilityBannerBase({
  browserType,
  isDismissable,
  onDismiss,
}: {
  browserType: "chrome" | "safari" | "firefox" | "other";
  isDismissable: boolean;
  onDismiss: () => void;
}): React.JSX.Element {
  const { classes, cx } = useStyles();

  const [prompt, fixText, downloadUrl] = (() => {
    switch (browserType) {
      case "chrome":
        return [
          `You’re using an outdated version of Chrome. Autotblick currently requires Chrome v${MINIMUM_CHROME_VERSION}+.`,
          "Update Chrome",
          "https://www.google.com/chrome/",
        ];
      case "safari":
        return [
          `You’re using an outdated version of Safari. Autotblick currently requires Safari v${MINIMUM_SAFARI_VERSION}+.`,
          "Update Safari",
          "https://support.apple.com/downloads/safari",
        ];
      case "firefox":
        return [
          `You’re using an outdated version of Firefox. Autotblick currently requires Firefox v${MINIMUM_FIREFOX_VERSION}+.`,
          "Update Firefox",
          "https://www.mozilla.org/firefox/",
        ];
      default:
        return [
          "You’re using an unsupported browser. Autotblick currently requires Chrome, Safari or Firefox.",
          "Download Chrome",
          "https://www.google.com/chrome/",
        ];
    }
  })();

  return (
    <div className={cx(classes.root, { [classes.fullscreen]: !isDismissable })}>
      <Stack direction={!isDismissable ? "column" : "row"} alignItems="center" gap={2}>
        <Warning24Filled className={classes.icon} />

        <div>
          <Typography variant="subtitle2">{prompt}</Typography>
          {browserType === "other" && (
            <Typography variant="body2">
              Check out our cross-browser support progress in GitHub discussion{" "}
              <Link
                color="inherit"
                href="https://github.com/orgs/foxglove/discussions/174"
                target="_blank"
              >
                #174
              </Link>
              .
            </Typography>
          )}
        </div>
      </Stack>

      <Stack direction="row" gap={1} alignItems="center">
        <Button
          href={downloadUrl}
          target="_blank"
          rel="noreferrer"
          color="inherit"
          variant="outlined"
          size="small"
          className={classes.button}
        >
          {fixText}
        </Button>

        {isDismissable && (
          <IconButton edge="end" color="inherit" size="small" onClick={onDismiss}>
            <Dismiss20Filled />
          </IconButton>
        )}
      </Stack>
    </div>
  );
}

export function CompatibilityBanner({
  browserType,
  currentVersion,
  isDismissable,
}: {
  browserType: "chrome" | "safari" | "firefox" | "other";
  currentVersion: number;
  isDismissable: boolean;
}): React.JSX.Element | ReactNull {
  const { classes } = useStyles();
  const muiTheme = createMuiTheme("dark");
  const [showBanner, setShowBanner] = useState(true);

  const isCompatible = (() => {
    switch (browserType) {
      case "chrome":
        return currentVersion >= MINIMUM_CHROME_VERSION;
      case "safari":
        return currentVersion >= MINIMUM_SAFARI_VERSION;
      case "firefox":
        return currentVersion >= MINIMUM_FIREFOX_VERSION;
      default:
        return false;
    }
  })();

  if (!showBanner || isCompatible) {
    return ReactNull;
  }

  return (
    <MuiThemeProvider theme={muiTheme}>
      <Portal>
        <CompatibilityBannerBase
          browserType={browserType}
          isDismissable={isDismissable}
          onDismiss={() => {
            setShowBanner(false);
          }}
        />
      </Portal>
      <div className={classes.spacer} />
    </MuiThemeProvider>
  );
}
