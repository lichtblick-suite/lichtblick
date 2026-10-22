// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { StoryObj } from "@storybook/react-webpack5";
import { useState } from "react";

import { DeltaOverlay, DeltaOverlayProps } from "./DeltaOverlay";

export default {
  title: "panels/shared/DeltaOverlay",
  component: DeltaOverlay,
};

const noop = (): void => {};

export const SingleSeries: StoryObj = {
  render: function Story() {
    const props: DeltaOverlayProps = {
      deltaRowLabel: "Delta",
      xColumnLabel: "X-axis",
      yColumnLabel: "Y-axis",
      markerALabel: "P1",
      markerBLabel: "P2",
      markerAColor: "#EF833A",
      markerBColor: "#EF833A",
      xValueA: 10.2,
      xValueB: 14.8,
      yValueA: 12.5,
      yValueB: 18.75,
      deltaX: 4.6,
      deltaY: 6.25,
      formatXValue: (value) => `${value.toFixed(2)}s`,
      onRemoveMarkerA: noop,
      onRemoveMarkerB: noop,
    };
    return <DeltaOverlay {...props} />;
  },
};

export const MultiSeriesCrossPoints: StoryObj = {
  render: function Story() {
    const props: DeltaOverlayProps = {
      deltaRowLabel: "Delta",
      xColumnLabel: "X-axis",
      yColumnLabel: "Y-axis",
      markerALabel: "P1",
      markerBLabel: "P2",
      markerAColor: "#EF833A",
      markerBColor: "#FFC107",
      xValueA: 4.6,
      xValueB: 6.0,
      yValueA: 93.688286,
      yValueB: 13.924775,
      deltaX: 1.4,
      deltaY: 79.763511,
      formatXValue: (value) => value.toFixed(6),
      formatYValue: (value) => value.toFixed(6),
      onRemoveMarkerA: noop,
      onRemoveMarkerB: noop,
    };
    return <DeltaOverlay {...props} />;
  },
};

// Mirrors how the StateTransitions panel will use this: Y isn't numeric, so `delta` stays
// undefined and only the raw state label at each marker is shown (no subtraction).
export const CategoricalStateValues: StoryObj = {
  render: function Story() {
    const props: DeltaOverlayProps = {
      deltaRowLabel: "Δt",
      xColumnLabel: "Time",
      yColumnLabel: "Value",
      markerALabel: "P1",
      markerBLabel: "P2",
      markerAColor: "#4CAF50",
      markerBColor: "#2196F3",
      xValueA: 5.0,
      xValueB: 11.4,
      yValueA: "IDLE",
      yValueB: "RUNNING",
      deltaX: 6.4,
      deltaY: undefined,
      formatXValue: (value) => `${value.toFixed(1)}s`,
      onRemoveMarkerA: noop,
      onRemoveMarkerB: noop,
    };
    return <DeltaOverlay {...props} />;
  },
};

// Lets you click the "x" buttons to see the removal callbacks wired up (each marker row
// disappears from this demo host, not from DeltaOverlay itself - it stays presentational).
export const Interactive: StoryObj = {
  render: function Story() {
    const [markerA, setMarkerA] = useState(true);
    const [markerB, setMarkerB] = useState(true);

    if (!markerA || !markerB) {
      return <div>Marker removed - reload the story to see it again.</div>;
    }

    const props: DeltaOverlayProps = {
      deltaRowLabel: "Delta",
      xColumnLabel: "X-axis",
      yColumnLabel: "Y-axis",
      markerALabel: "P1",
      markerBLabel: "P2",
      markerAColor: "#EF833A",
      markerBColor: "#FFC107",
      xValueA: 4.6,
      xValueB: 6.0,
      yValueA: 93.688286,
      yValueB: 13.924775,
      deltaX: 1.4,
      deltaY: 79.763511,
      formatXValue: (value) => value.toFixed(6),
      formatYValue: (value) => value.toFixed(6),
      onRemoveMarkerA: () => {
        setMarkerA(false);
      },
      onRemoveMarkerB: () => {
        setMarkerB(false);
      },
    };
    return <DeltaOverlay {...props} />;
  },
};

// Measure mode is active but only marker A has been placed yet - marker B, delta and the
// per-series delta column render as placeholders until the second point is clicked.
export const OnlyMarkerAPlaced: StoryObj = {
  render: function Story() {
    const props: DeltaOverlayProps = {
      deltaRowLabel: "Delta",
      xColumnLabel: "X-axis",
      yColumnLabel: "Y-axis",
      markerALabel: "P1",
      markerBLabel: "P2",
      markerAColor: "#EF833A",
      markerBColor: undefined,
      xValueA: 4.6,
      xValueB: undefined,
      yValueA: 93.688286,
      yValueB: undefined,
      deltaX: undefined,
      deltaY: undefined,
      formatXValue: (value) => value.toFixed(6),
      formatYValue: (value) => value.toFixed(6),
      onRemoveMarkerA: noop,
      onRemoveMarkerB: noop,
    };
    return <DeltaOverlay {...props} />;
  },
};
