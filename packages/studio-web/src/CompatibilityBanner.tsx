// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Warning24Filled, Dismiss20Filled } from "@fluentui/react-icons";
import {
  IconButton,
  Typography,
  Link,
  Button,
  ThemeProvider as MuiThemeProvider,
  Portal,
} from "@mui/material";
import { useState } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";
import { createMuiTheme } from "@foxglove/theme";

const MINIMUM_CHROME_VERSION = 76;
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
  isChrome,
  isDismissable,
  onDismiss,
}: {
  isChrome: boolean;
  isDismissable: boolean;
  onDismiss: () => void;
}): JSX.Element {
  const { classes, cx } = useStyles();

  const prompt = isChrome
    ? "You’re using an outdated version of Chrome."
    : "You’re using an unsupported browser.";
  const fixText = isChrome ? "Update Chrome" : "Download Chrome";

  return (
    <div className={cx(classes.root, { [classes.fullscreen]: !isDismissable })}>
      <Stack direction={!isDismissable ? "column" : "row"} alignItems="center" gap={2}>
        <Warning24Filled className={classes.icon} />

        <div>
          <Typography variant="subtitle2">
            {prompt} Foxglove Studio currently requires Chrome v{MINIMUM_CHROME_VERSION}+.
          </Typography>

          {!isChrome && (
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
          href="https://www.google.com/chrome/"
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
  isChrome,
  currentVersion,
  isDismissable,
}: {
  isChrome: boolean;
  currentVersion: number;
  isDismissable: boolean;
}): JSX.Element | ReactNull {
  const { classes } = useStyles();
  const muiTheme = createMuiTheme("dark");
  const [showBanner, setShowBanner] = useState(true);

  if (!showBanner || currentVersion >= MINIMUM_CHROME_VERSION) {
    return ReactNull;
  }

  return (
    <MuiThemeProvider theme={muiTheme}>
      <Portal>
        <CompatibilityBannerBase
          isChrome={isChrome}
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
