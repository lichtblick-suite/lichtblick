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
      xColumnLabel: "Time",
      markerALabel: "P1",
      markerBLabel: "P2",
      xValueA: 10.2,
      xValueB: 14.8,
      deltaX: 4.6,
      formatXValue: (value) => `${value.toFixed(2)}s`,
      seriesLabels: [{ configIndex: 0, label: "/imu/acceleration_x", color: "#4e98e2" }],
      series: [{ configIndex: 0, valueAtA: 12.5, valueAtB: 18.75, delta: 6.25 }],
      onRemoveMarkerA: noop,
      onRemoveMarkerB: noop,
      onClose: noop,
    };
    return <DeltaOverlay {...props} />;
  },
};

export const MultiSeries: StoryObj = {
  render: function Story() {
    const props: DeltaOverlayProps = {
      deltaRowLabel: "Delta",
      xColumnLabel: "Time",
      markerALabel: "P1",
      markerBLabel: "P2",
      xValueA: 2.115,
      xValueB: 9.837,
      deltaX: 7.722,
      formatXValue: (value) => `${value.toFixed(3)}s`,
      seriesLabels: [
        { configIndex: 0, label: "/imu/acceleration_x", color: "#4e98e2" },
        { configIndex: 1, label: "/imu/acceleration_y", color: "#f5a623" },
        { configIndex: 2, label: "/imu/acceleration_z", color: "#7ed321" },
      ],
      series: [
        { configIndex: 0, valueAtA: 1.2, valueAtB: -0.4, delta: 1.6 },
        { configIndex: 1, valueAtA: 0.05, valueAtB: 0.9, delta: 0.85 },
        { configIndex: 2, valueAtA: 9.81, valueAtB: 9.79, delta: 0.02 },
      ],
      onRemoveMarkerA: noop,
      onRemoveMarkerB: noop,
      onClose: noop,
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
      markerALabel: "P1",
      markerBLabel: "P2",
      xValueA: 5.0,
      xValueB: 11.4,
      deltaX: 6.4,
      formatXValue: (value) => `${value.toFixed(1)}s`,
      seriesLabels: [{ configIndex: 0, label: "/robot/state", color: "#bd10e0" }],
      series: [
        {
          configIndex: 0,
          valueAtA: "IDLE",
          valueAtB: "RUNNING",
          delta: undefined,
        },
      ],
      onRemoveMarkerA: noop,
      onRemoveMarkerB: noop,
      onClose: noop,
    };
    return <DeltaOverlay {...props} />;
  },
};

// One of the series has no data at either marker (e.g. the topic didn't publish there yet).
export const MissingSeriesResult: StoryObj = {
  render: function Story() {
    const props: DeltaOverlayProps = {
      deltaRowLabel: "Delta",
      xColumnLabel: "Time",
      markerALabel: "P1",
      markerBLabel: "P2",
      xValueA: 1.0,
      xValueB: 3.5,
      deltaX: 2.5,
      formatXValue: (value) => `${value.toFixed(2)}s`,
      seriesLabels: [
        { configIndex: 0, label: "/imu/acceleration_x", color: "#4e98e2" },
        { configIndex: 1, label: "/late/topic", color: "#f5a623" },
      ],
      series: [{ configIndex: 0, valueAtA: 1.2, valueAtB: -0.4, delta: 1.6 }],
      onRemoveMarkerA: noop,
      onRemoveMarkerB: noop,
      onClose: noop,
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
      xColumnLabel: "Time",
      markerALabel: "P1",
      markerBLabel: "P2",
      xValueA: 10.2,
      xValueB: 14.8,
      deltaX: 4.6,
      formatXValue: (value) => `${value.toFixed(2)}s`,
      seriesLabels: [{ configIndex: 0, label: "/imu/acceleration_x", color: "#4e98e2" }],
      series: [{ configIndex: 0, valueAtA: 12.5, valueAtB: 18.75, delta: 6.25 }],
      onRemoveMarkerA: () => {
        setMarkerA(false);
      },
      onRemoveMarkerB: () => {
        setMarkerB(false);
      },
      onClose: noop,
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
      xColumnLabel: "Time",
      markerALabel: "P1",
      markerBLabel: "P2",
      xValueA: 10.2,
      xValueB: undefined,
      deltaX: undefined,
      formatXValue: (value) => `${value.toFixed(2)}s`,
      seriesLabels: [{ configIndex: 0, label: "/imu/acceleration_x", color: "#4e98e2" }],
      series: [{ configIndex: 0, valueAtA: 12.5, valueAtB: undefined, delta: undefined }],
      onRemoveMarkerA: noop,
      onRemoveMarkerB: noop,
      onClose: noop,
    };
    return <DeltaOverlay {...props} />;
  },
};
