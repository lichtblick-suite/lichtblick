// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { Box } from "@mui/material";
import { Story } from "@storybook/react";
import { useState } from "react";
import { makeStyles } from "tss-react/mui";

import Slider from "./Slider";

const useStyles = makeStyles()((theme) => ({
  customMarker: {
    backgroundColor: theme.palette.background.paper,
    border: "1px solid",
    borderColor: theme.palette.text.primary,
    height: "150%",
    position: "absolute",
    top: "-25%",
    width: 6,
  },
  customRange: {
    backgroundColor: theme.palette.info.dark,
    borderRadius: theme.shape.borderRadius,
    height: "20%",
    left: 0,
    position: "absolute",
  },
}));

export default {
  title: "components/PlaybackControls/Slider",
};

export const Examples: Story = () => {
  const [value, setValue] = useState(0.5);
  const [draggableValue, setDraggableValue] = useState(0.25);
  return (
    <Box padding={4}>
      <p>standard (clickable)</p>
      <Box bgcolor="error.light" height={30} width={300}>
        <Slider onChange={(v) => setValue(v)} fraction={value} />
      </Box>
      <p>disabled (not clickable)</p>
      <Box bgcolor="error.light" height={30} width={300}>
        <Slider disabled onChange={(v) => setValue(v)} fraction={value} />
      </Box>
      <p>no value</p>
      <Box bgcolor="error.light" height={30} width={300}>
        <Slider
          onChange={() => {
            // no-op
          }}
          fraction={undefined}
        />
      </Box>
      <p>draggable</p>
      <Box bgcolor="info.main" height={20} width={500}>
        <Slider onChange={(v) => setDraggableValue(v)} fraction={draggableValue} />
      </Box>
    </Box>
  );
};

export const CustomRenderer: Story = () => {
  const { classes } = useStyles();
  const [draggableValue, setDraggableValue] = useState(0.25);

  return (
    <Box padding={4}>
      <p>Customize slider UI using renderSlider</p>
      <Box bgcolor="info.main" height={20} width={500}>
        <Slider
          onChange={(v) => setDraggableValue(v)}
          fraction={draggableValue}
          renderSlider={(width) => (
            <>
              <div className={classes.customRange} style={{ width: `${(width ?? 0) * 100}%` }} />
              <div className={classes.customMarker} style={{ left: `${(width ?? 0) * 100}%` }} />
            </>
          )}
        />
      </Box>
    </Box>
  );
};
