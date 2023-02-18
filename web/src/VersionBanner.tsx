// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CloseIcon from "@mui/icons-material/Close";
import {
  IconButton,
  Typography,
  Link,
  Button,
  styled as muiStyled,
  ThemeProvider as MuiThemeProvider,
} from "@mui/material";
import { useState, useMemo, ReactElement } from "react";
import { useTranslation } from "react-i18next";

import Stack from "@foxglove/studio-base/components/Stack";
import { Language } from "@foxglove/studio-base/i18n";
import { createMuiTheme } from "@foxglove/studio-base/theme";

const MINIMUM_CHROME_VERSION = 76;

const Root = muiStyled("div", {
  shouldForwardProp: (prop) => prop !== "isDismissable",
})<{ isDismissable: boolean }>(({ isDismissable, theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  zIndex: 100,

  ...(!isDismissable && {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: "100vh",
  }),
}));

const DismissButton = muiStyled(IconButton)(({ theme }) => ({
  position: "absolute",
  margin: theme.spacing(1),
  right: 0,
  top: 0,
}));

const VersionBanner = function ({
  isChrome,
  currentVersion,
  isDismissable,
}: {
  isChrome: boolean;
  currentVersion: number;
  isDismissable: boolean;
}): ReactElement | ReactNull {
  const [showBanner, setShowBanner] = useState(true);
  const { i18n } = useTranslation();
  const muiTheme = useMemo(
    () => createMuiTheme("dark", i18n.language as Language),
    [i18n.language],
  );

  if (!showBanner || currentVersion >= MINIMUM_CHROME_VERSION) {
    return ReactNull;
  }

  const prompt = isChrome
    ? "You’re using an outdated version of Chrome."
    : "You’re using an unsupported browser.";
  const fixText = isChrome ? "Update Chrome" : "Download Chrome";

  return (
    <MuiThemeProvider theme={muiTheme}>
      <Root isDismissable={isDismissable}>
        <Stack padding={2} gap={1.5} alignItems="center">
          {isDismissable && (
            <DismissButton color="inherit" onClick={() => setShowBanner(false)}>
              <CloseIcon />
            </DismissButton>
          )}

          <div>
            <Typography align="center" variant="h6">
              {prompt} Foxglove Studio currently requires Chrome v{MINIMUM_CHROME_VERSION}+.
            </Typography>

            {!isChrome && (
              <Typography align="center" variant="subtitle1">
                Check out our cross-browser support progress in GitHub issue{" "}
                <Link
                  color="inherit"
                  href="https://github.com/foxglove/studio/issues/1511"
                  target="_blank"
                >
                  #1511
                </Link>
                .
              </Typography>
            )}
          </div>

          <Button
            href="https://www.google.com/chrome/"
            target="_blank"
            rel="noreferrer"
            color="inherit"
            variant="outlined"
          >
            {fixText}
          </Button>
        </Stack>
      </Root>
    </MuiThemeProvider>
  );
};

export default VersionBanner;
