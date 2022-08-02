// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { ColorPicker } from "@fluentui/react";
import { Popover, TextField } from "@mui/material";
import { useCallback, useState } from "react";
import tinycolor from "tinycolor2";

import Stack from "@foxglove/studio-base/components/Stack";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

import { ColorSwatch } from "./ColorSwatch";

export function ColorGradientInput({
  colors,
  disabled = false,
  onChange,
  readOnly = false,
}: {
  colors: undefined | readonly [string, string];
  disabled?: boolean;
  onChange: (colors: [string, string]) => void;
  readOnly?: boolean;
}): JSX.Element {
  const [leftAnchor, setLeftAnchor] = useState<undefined | HTMLDivElement>(undefined);
  const [rightAnchor, setRightAnchor] = useState<undefined | HTMLDivElement>(undefined);

  const handleLeftClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (readOnly) {
        return;
      }

      setLeftAnchor(event.currentTarget);
      setRightAnchor(undefined);
    },
    [readOnly],
  );

  const handleRightClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (readOnly) {
        return;
      }

      setLeftAnchor(undefined);
      setRightAnchor(event.currentTarget);
    },
    [readOnly],
  );

  const handleClose = useCallback(() => {
    setLeftAnchor(undefined);
    setRightAnchor(undefined);
  }, []);

  const leftColor = colors?.[0] ?? "#000000";
  const rightColor = colors?.[1] ?? "#FFFFFF";
  const safeLeftColor = tinycolor(leftColor).isValid() ? leftColor : "#000000";
  const safeRightColor = tinycolor(rightColor).isValid() ? rightColor : "#FFFFFF";

  return (
    <Stack
      direction="row"
      style={{
        opacity: disabled ? 0.5 : 1,
        pointerEvents: disabled ? "none" : "auto",
        position: "relative",
        backgroundImage: `linear-gradient(to right, ${safeLeftColor}, ${safeRightColor})`,
      }}
    >
      <ColorSwatch color={safeLeftColor} onClick={handleLeftClick} />
      <TextField
        variant="filled"
        size="small"
        fullWidth
        value={`${leftColor} / ${rightColor}`}
        style={{ visibility: "hidden" }}
      />
      <ColorSwatch color={safeRightColor} onClick={handleRightClick} />
      <Popover
        open={leftAnchor != undefined}
        anchorEl={leftAnchor}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
      >
        <ColorPicker
          color={leftColor}
          alphaType="alpha"
          styles={{
            tableHexCell: { width: "35%" },
            input: {
              input: {
                fontFeatureSettings: `${fonts.SANS_SERIF_FEATURE_SETTINGS}, 'zero' !important`,
              },
            },
          }}
          onChange={(_event, newValue) => onChange([newValue.str, rightColor])}
        />
      </Popover>
      <Popover
        open={rightAnchor != undefined}
        anchorEl={rightAnchor}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
      >
        <ColorPicker
          color={rightColor}
          alphaType="alpha"
          styles={{
            tableHexCell: { width: "35%" },
            input: {
              input: {
                fontFeatureSettings: `${fonts.SANS_SERIF_FEATURE_SETTINGS}, 'zero' !important`,
              },
            },
          }}
          onChange={(_event, newValue) => onChange([leftColor, newValue.str])}
        />
      </Popover>
    </Stack>
  );
}
