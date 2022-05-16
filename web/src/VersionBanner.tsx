// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { DefaultButton } from "@fluentui/react";
import CloseIcon from "@mui/icons-material/Close";
import { IconButton, Typography, Link } from "@mui/material";
import { makeStyles } from "@mui/styles";
import cx from "classnames";
import { useState, ReactElement } from "react";

const MINIMUM_CHROME_VERSION = 76;

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    width: "100%",
    color: "white",
    backgroundColor: "rgba(99, 102, 241, 0.9)",
    zIndex: 100,
  },
  rootPersistant: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: "100vh",
  },
  inner: {
    display: "flex",
    flexDirection: "column",
    padding: 12,
    gap: 8,
    alignItems: "center",
  },
  closeButton: {
    position: "absolute !important" as unknown as "absolute",
    margin: 8,
    right: 0,
    top: 0,
  },
});

const VersionBanner = function ({
  isChrome,
  currentVersion,
  isDismissable,
}: {
  isChrome: boolean;
  currentVersion: number;
  isDismissable: boolean;
}): ReactElement | ReactNull {
  const classes = useStyles();
  const [showBanner, setShowBanner] = useState(true);

  if (!showBanner || currentVersion >= MINIMUM_CHROME_VERSION) {
    return ReactNull;
  }

  const prompt = isChrome
    ? "You’re using an outdated version of Chrome."
    : "You’re using an unsupported browser.";
  const fixText = isChrome ? "Update Chrome" : "Download Chrome";

  return (
    <div className={cx(classes.root, { [classes.rootPersistant]: !isDismissable })}>
      <div className={classes.inner}>
        {isDismissable && (
          <IconButton
            color="inherit"
            className={classes.closeButton}
            onClick={() => setShowBanner(false)}
          >
            <CloseIcon />
          </IconButton>
        )}

        <Typography color="common.white" fontSize="1.1em">
          {prompt} Foxglove Studio currently requires Chrome v{MINIMUM_CHROME_VERSION}+.
        </Typography>

        {!isChrome && (
          <Typography color="common.white" fontSize="1.1em">
            Check out our cross-browser support progress in GitHub issue{" "}
            <Link color="inherit" href="https://github.com/foxglove/studio/issues/1511">
              #1511
            </Link>
            .
          </Typography>
        )}

        <DefaultButton
          href="https://www.google.com/chrome/"
          target="_blank"
          rel="noreferrer"
          styles={{
            root: {
              color: "white",
              backgroundColor: "rgba(255,255, 255, 0.1)",
              borderRadius: "4px",
              border: "1px solid rgba(255,255,255,0.3)",
              fontSize: "1em",
            },
            rootHovered: {
              color: "white",
              backgroundColor: "rgba(255,255, 255, 0.3)",
            },
          }}
        >
          {fixText}
        </DefaultButton>
      </div>
    </div>
  );
};

export default VersionBanner;
