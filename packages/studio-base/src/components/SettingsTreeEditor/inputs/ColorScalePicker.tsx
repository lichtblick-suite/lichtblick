// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Button, ButtonProps, Menu, MenuItem, Typography } from "@mui/material";
import { useState } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";

const COLOR_SCALE_OPTIONS: [string, string[]][] = [
  [
    "turbo",
    [
      "rgb(35, 23, 27)",
      "rgb(74, 65, 181)",
      "rgb(66, 112, 242)",
      "rgb(47, 158, 245)",
      "rgb(37, 198, 215)",
      "rgb(47, 230, 173)",
      "rgb(78, 249, 131)",
      "rgb(124, 253, 94)",
      "rgb(176, 244, 68)",
      "rgb(223, 220, 50)",
      "rgb(255, 184, 39)",
      "rgb(255, 140, 31)",
      "rgb(244, 92, 23)",
      "rgb(206, 49, 13)",
      "rgb(163, 19, 2)",
      "rgb(144, 13, 0)",
    ],
  ],
  [
    "rainbow",
    [
      "#6e40aa",
      "#be3caf",
      "#fe4b83",
      "#ff7747",
      "#e3b62f",
      "#b0ef5a",
      "#53f666",
      "#1edfa2",
      "#23acd8",
      "#4c6fdc",
    ],
  ],
  [
    "cool",
    [
      "#7ef658",
      "#52f667",
      "#30ee83",
      "#1ddea3",
      "#1ac7c2",
      "#24aad8",
      "#368ce1",
      "#4c6edb",
      "#6154c8",
      "#6e40aa",
    ],
  ],
  [
    "viridis",
    [
      "#bddf26",
      "#7ad151",
      "#42be71",
      "#22a884",
      "#21908d",
      "#2a788e",
      "#355f8d",
      "#414487",
      "#482475",
      "#440154",
    ],
  ],
  [
    "plasma",
    [
      "#fcce25",
      "#fca636",
      "#f1834c",
      "#e16462",
      "#cb4679",
      "#b12a90",
      "#8f0da4",
      "#6a00a8",
      "#41049d",
      "#0d0887",
    ],
  ],
  [
    "inferno",
    [
      "#f6d746",
      "#fca50a",
      "#f3761b",
      "#dd513a",
      "#ba3655",
      "#932667",
      "#6a176e",
      "#420a68",
      "#160b39",
      "#000004",
    ],
  ],
];

const useStyles = makeStyles()((theme) => ({
  button: {
    padding: theme.spacing(0.5),
    backgroundColor: theme.palette.action.hover,
    borderColor: theme.palette.divider,
    display: "flex",
  },
}));

function ColorScale({ colors }: { colors: string[] }): JSX.Element {
  const backgroundImage = `linear-gradient(to right, ${colors.join(",")})`;

  return <Stack paddingBottom={2.5} flex="auto" style={{ backgroundImage }} />;
}

// ts-prune-ignore-next
export function ColorScalePicker(props: ColorScalePickerProps): JSX.Element {
  const { className, ...rest } = props;
  const [selectedOption, setSelectedOption] = useState<number>(0);
  const { classes, cx } = useStyles();
  const [anchorEl, setAnchorEl] = React.useState<undefined | HTMLElement>(undefined);
  const open = Boolean(anchorEl);
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(undefined);
  };

  return (
    <>
      <Button
        className={cx(className, classes.button)}
        variant="outlined"
        fullWidth
        id="colorscale-button"
        aria-controls={open ? "colorscale-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
        {...rest}
      >
        <ColorScale colors={COLOR_SCALE_OPTIONS[selectedOption]?.[1] ?? ["black"]} />
      </Button>
      <Menu
        id="colorscale-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "colorscale-button",
          disablePadding: true,
        }}
        PaperProps={{
          sx: {
            minWidth: 280,
          },
        }}
      >
        {COLOR_SCALE_OPTIONS.map(([name, colorScale], idx) => (
          <MenuItem
            divider={idx !== COLOR_SCALE_OPTIONS.length - 1}
            key={name}
            onClick={() => {
              setSelectedOption(idx);
              handleClose();
            }}
            style={{
              padding: 0.75,
              paddingLeft: 1.5,
            }}
          >
            <Typography variant="button" style={{ width: 60 }}>
              {name}
            </Typography>
            <ColorScale colors={colorScale} />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

type ColorScalePickerProps = ButtonProps;
