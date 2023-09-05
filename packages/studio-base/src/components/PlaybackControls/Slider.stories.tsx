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

import { StoryObj } from "@storybook/react";
import { useState } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";

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
  errorTrack: {
    backgroundColor: theme.palette.error.light,
    height: 30,
    width: 300,
  },
  infoTrack: {
    backgroundColor: theme.palette.info.main,
    height: 20,
    width: 500,
  },
}));

export default {
  title: "components/PlaybackControls/Slider",
};

export const Examples: StoryObj = {
  render: function Story() {
    const { classes } = useStyles();
    const [value, setValue] = useState(0.5);
    const [draggableValue, setDraggableValue] = useState(0.25);

    return (
      <Stack padding={4}>
        <p>standard (clickable)</p>
        <div className={classes.errorTrack}>
          <Slider
            onChange={(v) => {
              setValue(v);
            }}
            fraction={value}
          />
        </div>
        <p>disabled (not clickable)</p>
        <div className={classes.errorTrack}>
          <Slider
            disabled
            onChange={(v) => {
              setValue(v);
            }}
            fraction={value}
          />
        </div>
        <p>no value</p>
        <div className={classes.errorTrack}>
          <Slider
            onChange={() => {
              // no-op
            }}
            fraction={undefined}
          />
        </div>
        <p>draggable</p>
        <div className={classes.infoTrack}>
          <Slider
            onChange={(v) => {
              setDraggableValue(v);
            }}
            fraction={draggableValue}
          />
        </div>
      </Stack>
    );
  },
};

export const CustomRenderer: StoryObj = {
  render: function Story() {
    const { classes } = useStyles();
    const [draggableValue, setDraggableValue] = useState(0.25);

    return (
      <Stack padding={4}>
        <p>Customize slider UI using renderSlider</p>
        <div className={classes.infoTrack}>
          <Slider
            onChange={(v) => {
              setDraggableValue(v);
            }}
            fraction={draggableValue}
            renderSlider={(width) => (
              <>
                <div className={classes.customRange} style={{ width: `${(width ?? 0) * 100}%` }} />
                <div className={classes.customMarker} style={{ left: `${(width ?? 0) * 100}%` }} />
              </>
            )}
          />
        </div>
      </Stack>
    );
  },
};
