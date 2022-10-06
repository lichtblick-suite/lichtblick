// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Grid, NumericType } from "@foxglove/schemas";
import { MessageEvent, Topic } from "@foxglove/studio";
import { LayerSettingsFoxgloveGrid } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/FoxgloveGrid";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ThreeDeeRender from "../index";
import { TransformStamped } from "../ros";
import { QUAT_IDENTITY, rad2deg } from "./common";
import useDelayedFixture from "./useDelayedFixture";

export default {
  title: "panels/ThreeDeeRender",
  component: ThreeDeeRender,
  parameters: { colorScheme: "light" },
};

function makeGridData({ rows, cols, pattern }: { rows: number; cols: number; pattern: string }) {
  const grid = new Uint8Array(rows * cols);
  const view = new DataView(grid.buffer, grid.byteOffset, grid.byteLength);
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const offset = i * cols + j;
      if (pattern === "row-stripes") {
        view.setUint8(offset, i % 2 === 0 ? 100 : 0);
      } else if (pattern === "col-stripes") {
        view.setUint8(offset, j % 2 === 0 ? 100 : 0);
      } else if (pattern === "checkerboard") {
        view.setUint8(offset, (i + j) % 2 === 0 ? 100 : 0);
      } else if (pattern === "gradient") {
        view.setUint8(offset, Math.floor((i / rows) * 255));
      }
    }
  }
  return grid;
}

function copyGridAtPosition(
  grid: MessageEvent<Grid>,
  position: { x: number; y: number; z: number },
  topicName: string,
) {
  return {
    ...grid,
    topic: topicName,
    message: {
      ...grid.message,
      pose: {
        ...grid.message.pose,
        position,
      },
    },
  };
}

function Foxglove_Grid_Uint8(): JSX.Element {
  const topics: Topic[] = [
    { name: "/grid", datatype: "foxglove.Grid" },
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TransformStamped> = {
    topic: "/tf",
    schemaName: "geometry_msgs/TransformStamped",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "map" },
      child_frame_id: "base_link",
      transform: {
        translation: { x: 1e7, y: 0, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    sizeInBytes: 0,
  };
  const tf2: MessageEvent<TransformStamped> = {
    topic: "/tf",
    schemaName: "geometry_msgs/TransformStamped",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      child_frame_id: "sensor",
      transform: {
        translation: { x: 0, y: 0, z: 1 },
        rotation: QUAT_IDENTITY,
      },
    },
    sizeInBytes: 0,
  };

  const column_count = 16;
  const rowCount = 16;
  const cell_stride = 4;
  const row_stride = column_count * cell_stride;
  const rowStripes = makeGridData({
    rows: rowCount,
    cols: column_count,
    pattern: "row-stripes",
  });
  const colStripes = makeGridData({
    rows: rowCount,
    cols: column_count,
    pattern: "col-stripes",
  });
  const checkerboard = makeGridData({
    rows: rowCount,
    cols: column_count,
    pattern: "checkerboard",
  });
  const gradient = makeGridData({
    rows: rowCount,
    cols: column_count,
    pattern: "gradient",
  });
  const data = new Uint8Array(column_count * rowCount * cell_stride);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let i = 0; i < rowCount * column_count; i++) {
    const offset = i * cell_stride;
    view.setUint8(offset, rowStripes[i]!);
    view.setUint8(offset + 1, colStripes[i]!);
    view.setUint8(offset + 2, checkerboard[i]!);
    view.setUint8(offset + 3, gradient[i]!);
  }

  const cell_size = {
    x: 0.2,
    y: 0.2,
  };
  const grid: MessageEvent<Grid> = {
    topic: "/grid",
    schemaName: "foxglove.Grid",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "sensor",
      pose: {
        position: {
          x: -0.5 * cell_size.x * rowCount + 2,
          y: -0.5 * cell_size.y * column_count + 2,
          z: 0,
        },
        orientation: QUAT_IDENTITY,
      },
      cell_size,
      column_count,
      cell_stride,
      row_stride,
      fields: [
        { name: "rowStripes", offset: 0, type: 1 },
        { name: "colStripes", offset: 1, type: 1 },
        { name: "checkerboard", offset: 2, type: 1 },
        { name: "gradient", offset: 3, type: 1 },
      ],
      data,
    },
    sizeInBytes: 0,
  };

  const grid2 = copyGridAtPosition(
    grid,
    {
      x: -0.5 * cell_size.x * rowCount + 2,
      y: -0.5 * cell_size.y * column_count - 2,
      z: 0,
    },
    "/grid2",
  );
  topics.push({ name: "/grid2", datatype: "foxglove.Grid" });
  const grid3 = copyGridAtPosition(
    grid,
    {
      x: -0.5 * cell_size.x * rowCount - 2,
      y: -0.5 * cell_size.y * column_count + 2,
      z: 0,
    },
    "/grid3",
  );
  topics.push({ name: "/grid3", datatype: "foxglove.Grid" });
  const grid4 = copyGridAtPosition(
    grid,
    {
      x: -0.5 * cell_size.x * rowCount - 2,
      y: -0.5 * cell_size.y * column_count - 2,
      z: 0,
    },
    "/grid4",
  );
  topics.push({ name: "/grid4", datatype: "foxglove.Grid" });

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/grid": [grid],
      "/grid2": [grid2],
      "/grid3": [grid3],
      "/grid4": [grid4],
      "/tf": [tf1, tf2],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeeRender
        overrideConfig={{
          followTf: "base_link",
          topics: {
            "/grid": {
              visible: true,
              colorField: "checkerboard",
              colorMode: "gradient",
              gradient: ["#ff0000ff", "#00ff0001"],
            } as LayerSettingsFoxgloveGrid,
            "/grid2": {
              visible: true,
              colorField: "gradient",
              colorMode: "colormap",
              colorMap: "rainbow",
            } as LayerSettingsFoxgloveGrid,
            "/grid3": {
              visible: true,
              colorField: "gradient",
              colorMode: "colormap",
              colorMap: "turbo",
            } as LayerSettingsFoxgloveGrid,
            "/grid4": {
              visible: true,
              colorField: "colStripes",
              colorMode: "colormap",
              colorMap: "turbo",
            } as LayerSettingsFoxgloveGrid,
          },
          layers: {
            grid: { layerId: "foxglove.Grid" },
          },
          cameraState: {
            distance: 13.5,
            perspective: true,
            phi: 0.1,
            targetOffset: [0.25, -0.5, 0],
            thetaOffset: 0,
            fovy: rad2deg(0.75),
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
        }}
      />
    </PanelSetup>
  );
}
function rgba(r: number, g: number, b: number, a: number) {
  return (
    (Math.trunc(r * 255) << 24) |
    (Math.trunc(g * 255) << 16) |
    (Math.trunc(b * 255) << 8) |
    Math.trunc(a * 255)
  );
}

function f(x: number, y: number) {
  return (x / 128 - 0.5) ** 2 + (y / 128 - 0.5) ** 2;
}
function jet(x: number, a: number): number {
  const i = Math.trunc(x * 255);
  const r = Math.max(0, Math.min(255, 4 * (i - 96), 255 - 4 * (i - 224)));
  const g = Math.max(0, Math.min(255, 4 * (i - 32), 255 - 4 * (i - 160)));
  const b = Math.max(0, Math.min(255, 4 * i + 127, 255 - 4 * (i - 96)));
  return rgba(r / 255, g / 255, b / 255, a);
}
function Foxglove_Grid_RGBA(): JSX.Element {
  const topics: Topic[] = [
    { name: "/grid", datatype: "foxglove.Grid" },
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TransformStamped> = {
    topic: "/tf",
    schemaName: "geometry_msgs/TransformStamped",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "map" },
      child_frame_id: "base_link",
      transform: {
        translation: { x: 1e7, y: 0, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    sizeInBytes: 0,
  };
  const tf2: MessageEvent<TransformStamped> = {
    topic: "/tf",
    schemaName: "geometry_msgs/TransformStamped",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      child_frame_id: "sensor",
      transform: {
        translation: { x: 0, y: 0, z: 1 },
        rotation: QUAT_IDENTITY,
      },
    },
    sizeInBytes: 0,
  };

  const column_count = 128;
  const rowCount = 128;
  const cell_stride = 4;
  const row_stride = column_count * cell_stride;

  const data = new Uint8Array(column_count * rowCount * cell_stride);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let i = 0; i < rowCount; i++) {
    for (let j = 0; j < column_count; j++) {
      const offset = i * column_count + j;
      view.setUint32(offset * 4, jet(f(i, j) * 2, i / rowCount), true);
    }
  }
  const cell_size = {
    x: 0.07,
    y: 0.07,
  };
  const grid: MessageEvent<Grid> = {
    topic: "/grid",
    schemaName: "foxglove.Grid",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "sensor",
      pose: {
        position: {
          x: -0.5 * cell_size.x * rowCount,
          y: -0.5 * cell_size.y * column_count,
          z: 0,
        },
        orientation: QUAT_IDENTITY,
      },
      cell_size,
      column_count,
      cell_stride,
      row_stride,
      fields: [{ name: "color", offset: 0, type: NumericType.UINT32 }],
      data,
    },
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/grid": [grid],
      "/tf": [tf1, tf2],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeeRender
        overrideConfig={{
          followTf: "base_link",
          topics: {
            "/grid": {
              visible: true,
              colorField: "color",
              colorMode: "rgba",
            } as LayerSettingsFoxgloveGrid,
          },
          layers: {
            grid: { layerId: "foxglove.Grid" },
          },
          cameraState: {
            distance: 13.5,
            perspective: true,
            phi: 0.1,
            targetOffset: [0.25, -0.5, 0],
            thetaOffset: 0,
            fovy: rad2deg(0.75),
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
        }}
      />
    </PanelSetup>
  );
}

function Foxglove_Grid_Float(): JSX.Element {
  const topics: Topic[] = [
    { name: "/grid", datatype: "foxglove.Grid" },
    { name: "/tf", datatype: "geometry_msgs/TransformStamped" },
  ];
  const tf1: MessageEvent<TransformStamped> = {
    topic: "/tf",
    schemaName: "geometry_msgs/TransformStamped",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "map" },
      child_frame_id: "base_link",
      transform: {
        translation: { x: 1e7, y: 0, z: 0 },
        rotation: QUAT_IDENTITY,
      },
    },
    sizeInBytes: 0,
  };
  const tf2: MessageEvent<TransformStamped> = {
    topic: "/tf",
    schemaName: "geometry_msgs/TransformStamped",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      child_frame_id: "sensor",
      transform: {
        translation: { x: 0, y: 0, z: 1 },
        rotation: QUAT_IDENTITY,
      },
    },
    sizeInBytes: 0,
  };

  const column_count = 128;
  const rowCount = 128;
  const cell_stride = 8;
  const row_stride = column_count * cell_stride;

  const data = new Uint8Array(column_count * rowCount * cell_stride);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (let i = 0; i < rowCount; i++) {
    for (let j = 0; j < column_count; j++) {
      const offset = (i * column_count + j) * cell_stride;
      view.setFloat32(offset, f(i, j), true);
    }
  }
  const cell_size = {
    x: 0.07,
    y: 0.07,
  };
  const grid: MessageEvent<Grid> = {
    topic: "/grid",
    schemaName: "foxglove.Grid",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "sensor",
      pose: {
        position: {
          x: -0.5 * cell_size.x * rowCount,
          y: -0.5 * cell_size.y * column_count,
          z: 0,
        },
        orientation: QUAT_IDENTITY,
      },
      cell_size,
      column_count,
      cell_stride,
      row_stride,
      fields: [{ name: "height", offset: 0, type: NumericType.FLOAT32 }],
      data,
    },
    sizeInBytes: 0,
  };

  const fixture = useDelayedFixture({
    topics,
    frame: {
      "/grid": [grid],
      "/tf": [tf1, tf2],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  });

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeeRender
        overrideConfig={{
          followTf: "base_link",
          topics: {
            "/grid": {
              visible: true,
              colorField: "height",
              colorMode: "gradient",
              gradient: ["#ffffffFF", "#ff00bb80"],
              minValue: -0.25,
              maxValue: 0.25,
            } as LayerSettingsFoxgloveGrid,
          },
          layers: {
            grid: { layerId: "foxglove.Grid" },
          },
          cameraState: {
            distance: 13.5,
            perspective: true,
            phi: 0.1,
            targetOffset: [0.25, -0.5, 0],
            thetaOffset: 0,
            fovy: rad2deg(0.75),
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
        }}
      />
    </PanelSetup>
  );
}
export const Foxglove_Grid_Uint8_Values = (): JSX.Element => <Foxglove_Grid_Uint8 />;
export const Foxglove_Grid_RGBA_Values = (): JSX.Element => <Foxglove_Grid_RGBA />;
export const Foxglove_Grid_Float_Values = (): JSX.Element => <Foxglove_Grid_Float />;
