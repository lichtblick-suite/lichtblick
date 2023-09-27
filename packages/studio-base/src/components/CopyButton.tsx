// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Copy16Regular,
  Copy20Regular,
  Copy24Regular,
  Checkmark16Filled,
  Checkmark20Filled,
  Checkmark24Filled,
} from "@fluentui/react-icons";
import {
  Button,
  ButtonProps,
  IconButton,
  IconButtonProps,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { useCallback, useState, PropsWithChildren, useMemo } from "react";

import clipboard from "@foxglove/studio-base/util/clipboard";

function CopyButtonComponent(
  props: PropsWithChildren<{
    getText: () => string;
    size?: "small" | "medium" | "large";
    iconSize?: "small" | "medium" | "large";
    color?: ButtonProps["color"];
    className?: string;
    edge?: IconButtonProps["edge"];
  }>,
): JSX.Element {
  const {
    children,
    className,
    color = "primary",
    edge,
    size = "medium",
    iconSize = "medium",
    getText,
  } = props;
  const theme = useTheme();
  const [copied, setCopied] = useState(false);

  const checkIcon = useMemo(() => {
    switch (iconSize) {
      case "small":
        return <Checkmark16Filled primaryFill={theme.palette.success.main} />;
      case "medium":
        return <Checkmark20Filled primaryFill={theme.palette.success.main} />;
      case "large":
        return <Checkmark24Filled primaryFill={theme.palette.success.main} />;
    }
  }, [iconSize, theme.palette.success.main]);

  const copyIcon = useMemo(() => {
    switch (iconSize) {
      case "small":
        return <Copy16Regular />;
      case "medium":
        return <Copy20Regular />;
      case "large":
        return <Copy24Regular />;
    }
  }, [iconSize]);

  const handleCopy = useCallback(() => {
    clipboard
      .copy(getText())
      .then(() => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, 1500);
      })
      .catch((err) => {
        console.warn(err);
      });
  }, [getText]);

  if (children == undefined) {
    return (
      <Tooltip arrow title={copied ? "Copied" : "Copy to clipboard"}>
        <IconButton
          edge={edge}
          className={className}
          size={size}
          onClick={handleCopy}
          color={copied ? "success" : color}
        >
          {copied ? checkIcon : copyIcon}
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Button
      size={size}
      className={className}
      onClick={handleCopy}
      color="inherit"
      startIcon={copied ? checkIcon : copyIcon}
    >
      <Typography color={copied ? "text.primary" : color} variant="body2">
        {children}
      </Typography>
    </Button>
  );
}

export default React.memo(CopyButtonComponent);
