// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import CheckIcon from "@mui/icons-material/Check";
import CopyAllIcon from "@mui/icons-material/CopyAll";
import {
  Button,
  ButtonProps,
  IconButton,
  IconButtonProps,
  SvgIconProps,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useState, PropsWithChildren } from "react";

import clipboard from "@foxglove/studio-base/util/clipboard";

function CopyButtonComponent(
  props: PropsWithChildren<{
    getText: () => string;
    size?: "small" | "medium" | "large";
    iconSize?: SvgIconProps["fontSize"];
    color?: ButtonProps["color"] | IconButtonProps["color"];
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
  const [copied, setCopied] = useState(false);

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
          {copied ? <CheckIcon fontSize={iconSize} /> : <CopyAllIcon fontSize={iconSize} />}
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <Button
      size={size}
      color="inherit"
      className={className}
      onClick={handleCopy}
      startIcon={
        copied ? (
          <CheckIcon fontSize={iconSize} color="success" />
        ) : (
          <CopyAllIcon fontSize={iconSize} color="primary" />
        )
      }
    >
      <Typography color={copied ? "text.primary" : color} variant="body2">
        {children}
      </Typography>
    </Button>
  );
}

export default React.memo(CopyButtonComponent);
