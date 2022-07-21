// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { keyframes } from "@emotion/react";
import { simplify } from "intervals-fn";
import { useMemo } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";
import { Range } from "@foxglove/studio-base/util/ranges";

type ProgressProps = {
  loading: boolean;
  availableRanges?: Range[];
};

const STRIPE_WIDTH = 8;

const animatedBackground = keyframes`
  0% { background-position: 0 0; }
  100% { background-position: ${STRIPE_WIDTH * 2}px 0; }
`;

const useStyles = makeStyles()((theme) => ({
  loadingIndicator: {
    label: "ProgressPlot-loadingIndicator",
    position: "absolute",
    width: "100%",
    height: "100%",
    animation: `${animatedBackground} 300ms linear infinite`,
    backgroundRepeat: "repeat-x",
    backgroundSize: `${STRIPE_WIDTH * 2}px 100%`,
    backgroundImage: `repeating-linear-gradient(${[
      "90deg",
      `${theme.palette.background.paper}`,
      `${theme.palette.background.paper} ${STRIPE_WIDTH / 2}px`,
      `transparent ${STRIPE_WIDTH / 2}px`,
      `transparent ${STRIPE_WIDTH}px`,
    ].join(",")})`,
  },
  range: {
    label: "ProgressPlot-range",
    position: "absolute",
    backgroundColor: theme.palette.text.secondary,
    height: "100%",
  },
}));

export function ProgressPlot(props: ProgressProps): JSX.Element {
  const { availableRanges, loading } = props;
  const { classes } = useStyles();

  const ranges = useMemo(() => {
    if (!availableRanges) {
      return <></>;
    }
    const mergedRanges = simplify(availableRanges);

    return mergedRanges.map((range, idx) => {
      const width = range.end - range.start;
      if (width === 0) {
        return <></>;
      }
      return (
        <div
          className={classes.range}
          key={idx}
          style={{
            width: `${width * 100}%`,
            left: `${range.start * 100}%`,
          }}
        />
      );
    });
  }, [availableRanges, classes.range]);

  return (
    <Stack position="relative" fullHeight>
      {loading && <div className={classes.loadingIndicator} />}
      {ranges}
    </Stack>
  );
}
