// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";

import {
  CameraCalibration,
  ImageAnnotations,
  PointsAnnotationType,
  RawImage,
} from "@foxglove/schemas";
import { MessageEvent } from "@foxglove/studio";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";

import { ImagePanel } from "../../index";

export default {
  title: "panels/ThreeDeeRender/Images/Annotations",
  component: ImagePanel,
};
function makeImageAndCalibration(width: number, height: number) {
  const fx = 500;
  const fy = 500;
  const cx = width / 2;
  const cy = height / 2;
  const calibrationMessage: MessageEvent<Partial<CameraCalibration>> = {
    topic: "calibration",
    receiveTime: { sec: 0, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "cam",
      height,
      width,
      distortion_model: "rational_polynomial",
      D: [],
      K: [fx, 0, cx, 0, fy, cy, 0, 0, 1],
      R: [1, 0, 0, 1, 0, 0, 1, 0, 0],
      P: [fx, 0, cx, 0, 0, fy, cy, 0, 0, 0, 1, 0],
    },
    schemaName: "foxglove.CameraCalibration",
    sizeInBytes: 0,
  };

  const imageData = new Uint8Array(width * height * 3);
  for (let i = 0, r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (r === 0 || r === height - 1 || c === 0 || c === width - 1) {
        imageData[i++] = 150;
        imageData[i++] = 150;
        imageData[i++] = 255;
      } else {
        imageData[i++] = (r % 2 === 0 ? 127 : 0) + (c % 2 === 0 ? 127 : 0);
        imageData[i++] = (r % 2 === 0 ? 127 : 0) + (c % 2 === 0 ? 127 : 0);
        imageData[i++] = (r % 2 === 0 ? 127 : 0) + (c % 2 === 0 ? 127 : 0);
      }
    }
  }

  const cameraMessage: MessageEvent<Partial<RawImage>> = {
    topic: "camera",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      frame_id: "cam",
      width,
      height,
      encoding: "rgb8",
      data: imageData,
    },
    schemaName: "foxglove.RawImage",
    sizeInBytes: 0,
  };

  return { calibrationMessage, cameraMessage };
}

export const Annotations: StoryObj = {
  parameters: { colorScheme: "light" },
  render: function Story() {
    const width = 60;
    const height = 45;

    const { calibrationMessage, cameraMessage } = makeImageAndCalibration(width, height);

    const annotationsMessage: MessageEvent<Partial<ImageAnnotations>> = {
      topic: "annotations",
      receiveTime: { sec: 10, nsec: 0 },
      message: {
        circles: [
          {
            timestamp: { sec: 0, nsec: 0 },
            position: { x: 20, y: 5 },
            diameter: 4,
            thickness: 1,
            fill_color: { r: 1, g: 0, b: 1, a: 1 },
            outline_color: { r: 1, g: 1, b: 0, a: 1 },
          },
          {
            timestamp: { sec: 0, nsec: 0 },
            position: { x: 25, y: 5 },
            diameter: 4,
            thickness: 1,
            fill_color: { r: 1, g: 0, b: 1, a: 0.5 },
            outline_color: { r: 0, g: 0, b: 0, a: 0 },
          },
          {
            timestamp: { sec: 0, nsec: 0 },
            position: { x: 30, y: 5 },
            diameter: 4,
            thickness: 0.5,
            fill_color: { r: 1, g: 1, b: 0, a: 0 },
            outline_color: { r: 0, g: 1, b: 1, a: 0.5 },
          },
        ],
        points: [
          {
            timestamp: { sec: 0, nsec: 0 },
            type: PointsAnnotationType.POINTS,
            points: [
              { x: 0, y: 0 },
              { x: 0, y: 8 },
              { x: 2, y: 6 },
              { x: 5, y: 2 },
            ],
            outline_color: { r: 1, g: 0, b: 0, a: 1 },
            outline_colors: [],
            fill_color: { r: 0, g: 0, b: 0, a: 0 },
            thickness: 1,
          },
          {
            timestamp: { sec: 0, nsec: 0 },
            type: PointsAnnotationType.POINTS,
            points: [
              { x: 10 + 0, y: 0 },
              { x: 10 + 0, y: 8 },
              { x: 10 + 2, y: 6 },
              { x: 10 + 5, y: 2 },
            ],
            outline_color: { r: 0, g: 0, b: 0, a: 1 },
            outline_colors: [
              { r: 1, g: 0, b: 0, a: 1 },
              { r: 0, g: 1, b: 0, a: 1 },
              { r: 0, g: 0, b: 1, a: 1 },
              { r: 0, g: 1, b: 1, a: 1 },
            ],
            fill_color: { r: 0, g: 0, b: 0, a: 0 },
            thickness: 2,
          },
          {
            timestamp: { sec: 0, nsec: 0 },
            type: PointsAnnotationType.LINE_LIST,
            points: [
              { x: 0, y: 10 + 0 },
              { x: 0, y: 10 + 8 },
              { x: 2, y: 10 + 6 },
              { x: 5, y: 10 + 2 },
            ],
            outline_color: { r: 1, g: 0, b: 0, a: 1 },
            outline_colors: [],
            fill_color: { r: 0, g: 0, b: 0, a: 0 },
            thickness: 1,
          },
          {
            timestamp: { sec: 0, nsec: 0 },
            type: PointsAnnotationType.LINE_LIST,
            points: [
              { x: 10 + 0, y: 10 + 0 },
              { x: 10 + 0, y: 10 + 8 },
              { x: 10 + 2, y: 10 + 6 },
              { x: 10 + 5, y: 10 + 2 },
            ],
            outline_color: { r: 0, g: 0, b: 0, a: 1 },
            outline_colors: [
              // 1 color per point
              { r: 1, g: 0, b: 0, a: 1 },
              { r: 0, g: 1, b: 0, a: 1 },
              { r: 0, g: 0, b: 1, a: 1 },
              { r: 0, g: 1, b: 1, a: 1 },
            ],
            fill_color: { r: 0, g: 0, b: 0, a: 0 },
            thickness: 2,
          },
          {
            timestamp: { sec: 0, nsec: 0 },
            type: PointsAnnotationType.LINE_LIST,
            points: [
              { x: 20 + 0, y: 10 + 0 },
              { x: 20 + 0, y: 10 + 8 },
              { x: 20 + 2, y: 10 + 6 },
              { x: 20 + 5, y: 10 + 2 },
            ],
            outline_color: { r: 0, g: 0, b: 0, a: 1 },
            outline_colors: [
              // 1 color per line
              { r: 1, g: 0, b: 0, a: 1 },
              { r: 0, g: 1, b: 0, a: 1 },
            ],
            fill_color: { r: 0, g: 0, b: 0, a: 0 },
            thickness: 2,
          },
          {
            timestamp: { sec: 0, nsec: 0 },
            type: PointsAnnotationType.LINE_STRIP,
            points: [
              { x: 0, y: 20 + 0 },
              { x: 0, y: 20 + 8 },
              { x: 2, y: 20 + 6 },
              { x: 5, y: 20 + 2 },
            ],
            outline_color: { r: 1, g: 0, b: 0, a: 1 },
            outline_colors: [],
            fill_color: { r: 0, g: 0, b: 0, a: 0 },
            thickness: 1,
          },
          {
            timestamp: { sec: 0, nsec: 0 },
            type: PointsAnnotationType.LINE_STRIP,
            points: [
              { x: 10 + 0, y: 20 + 0 },
              { x: 10 + 0, y: 20 + 8 },
              { x: 10 + 2, y: 20 + 6 },
              { x: 10 + 5, y: 20 + 2 },
            ],
            outline_color: { r: 1, g: 1, b: 0, a: 1 },
            outline_colors: [],
            fill_color: { r: 1, g: 0, b: 1, a: 1 },
            thickness: 0.5,
          },
          {
            timestamp: { sec: 0, nsec: 0 },
            type: PointsAnnotationType.LINE_LOOP,
            points: [
              { x: 0, y: 30 + 0 },
              { x: 0, y: 30 + 8 },
              { x: 2, y: 30 + 6 },
              { x: 5, y: 30 + 2 },
            ],
            outline_color: { r: 1, g: 0, b: 0, a: 1 },
            outline_colors: [],
            fill_color: { r: 0, g: 0, b: 0, a: 0 },
            thickness: 1,
          },
          {
            timestamp: { sec: 0, nsec: 0 },
            type: PointsAnnotationType.LINE_LOOP,
            points: [
              { x: 10 + 0, y: 30 + 0 },
              { x: 10 + 0, y: 30 + 8 },
              { x: 10 + 2, y: 30 + 6 },
              { x: 10 + 5, y: 30 + 2 },
            ],
            outline_color: { r: 1, g: 1, b: 0, a: 1 },
            outline_colors: [],
            fill_color: { r: 1, g: 0, b: 1, a: 1 },
            thickness: 0.5,
          },
        ],
      },
      schemaName: "foxglove.ImageAnnotations",
      sizeInBytes: 0,
    };

    const fixture: Fixture = {
      topics: [
        { name: "calibration", schemaName: "foxglove.CameraCalibration" },
        { name: "camera", schemaName: "foxglove.RawImage" },
        { name: "annotations", schemaName: "foxglove.ImageAnnotations" },
      ],
      frame: {
        calibration: [calibrationMessage],
        camera: [cameraMessage],
        annotations: [annotationsMessage],
      },
      capabilities: [],
      activeData: {
        currentTime: { sec: 0, nsec: 0 },
      },
    };
    return (
      <PanelSetup fixture={fixture}>
        <ImagePanel
          overrideConfig={{
            ...ImagePanel.defaultConfig,
            imageMode: {
              calibrationTopic: "calibration",
              imageTopic: "camera",
              annotations: [
                {
                  topic: "annotations",
                  schemaName: "foxglove.ImageAnnotations",
                  settings: { visible: true },
                },
              ],
            },
          }}
        />
      </PanelSetup>
    );
  },
};

export const MessageConverterSupport: StoryObj = {
  parameters: { colorScheme: "light" },
  render: function Story() {
    const width = 60;
    const height = 45;

    const { calibrationMessage, cameraMessage } = makeImageAndCalibration(width, height);

    const annotationsMessage: MessageEvent<Partial<ImageAnnotations>> = {
      topic: "annotations",
      receiveTime: { sec: 10, nsec: 0 },
      message: {
        points: [
          {
            timestamp: { sec: 0, nsec: 0 },
            type: PointsAnnotationType.POINTS,
            points: [
              { x: 10 + 0, y: 10 + 0 },
              { x: 10 + 0, y: 10 + 8 },
              { x: 10 + 2, y: 10 + 6 },
              { x: 10 + 5, y: 10 + 2 },
            ],
            outline_color: { r: 0, g: 0, b: 0, a: 1 },
            outline_colors: [
              { r: 1, g: 0, b: 0, a: 1 },
              { r: 0, g: 1, b: 0, a: 1 },
              { r: 0, g: 0, b: 1, a: 1 },
              { r: 0, g: 1, b: 1, a: 1 },
            ],
            fill_color: { r: 0, g: 0, b: 0, a: 0 },
            thickness: 1,
          },
        ],
      },
      schemaName: "foxglove.ImageAnnotations",
      sizeInBytes: 0,
    };

    const customAnnotationsMessage: MessageEvent<Partial<unknown>> = {
      topic: "custom_annotations",
      receiveTime: { sec: 10, nsec: 0 },
      message: { foo: "bar" },
      schemaName: "MyCustomSchema",
      sizeInBytes: 0,
    };

    const fixture: Fixture = {
      topics: [
        { name: "calibration", schemaName: "foxglove.CameraCalibration" },
        { name: "camera", schemaName: "foxglove.RawImage" },
        { name: "annotations", schemaName: "foxglove.ImageAnnotations" },
        { name: "custom_annotations", schemaName: "MyCustomSchema" },
      ],
      frame: {
        calibration: [calibrationMessage],
        camera: [cameraMessage],
        annotations: [annotationsMessage],
        custom_annotations: [customAnnotationsMessage],
      },
      capabilities: [],
      activeData: {
        currentTime: { sec: 0, nsec: 0 },
      },
      messageConverters: [
        // both original and converted schemas are supported
        {
          fromSchemaName: "foxglove.ImageAnnotations",
          toSchemaName: "foxglove_msgs/ImageAnnotations",
          converter: (_msg): Partial<ImageAnnotations> => ({
            points: [
              {
                timestamp: { sec: 0, nsec: 0 },
                type: PointsAnnotationType.LINE_LOOP,
                points: [
                  { x: 20 + 0, y: 10 + 0 },
                  { x: 20 + 0, y: 10 + 8 },
                  { x: 20 + 2, y: 10 + 6 },
                  { x: 20 + 5, y: 10 + 2 },
                ],
                outline_color: { r: 1, g: 1, b: 0, a: 1 },
                outline_colors: [],
                fill_color: { r: 0, g: 1, b: 1, a: 0 },
                thickness: 1,
              },
            ],
          }),
        },
        // original schema is not supported, but two converters are supported
        {
          fromSchemaName: "MyCustomSchema",
          toSchemaName: "foxglove_msgs/ImageAnnotations",
          converter: (_msg): Partial<ImageAnnotations> => ({
            points: [
              {
                timestamp: { sec: 0, nsec: 0 },
                type: PointsAnnotationType.LINE_LIST,
                points: [
                  { x: 30 + 0, y: 10 + 0 },
                  { x: 30 + 0, y: 10 + 8 },
                  { x: 30 + 2, y: 10 + 6 },
                  { x: 30 + 5, y: 10 + 2 },
                ],
                outline_color: { r: 0, g: 0, b: 0, a: 1 },
                outline_colors: [
                  // 1 color per point
                  { r: 1, g: 0, b: 0, a: 1 },
                  { r: 0, g: 1, b: 0, a: 1 },
                  { r: 0, g: 0, b: 1, a: 1 },
                  { r: 0, g: 1, b: 1, a: 1 },
                ],
                fill_color: { r: 0, g: 0, b: 0, a: 0 },
                thickness: 2,
              },
            ],
          }),
        },
        {
          fromSchemaName: "MyCustomSchema",
          toSchemaName: "foxglove_msgs/msg/ImageAnnotations",
          converter: (_msg): Partial<ImageAnnotations> => ({
            points: [
              {
                timestamp: { sec: 0, nsec: 0 },
                type: PointsAnnotationType.LINE_STRIP,
                points: [
                  { x: 40 + 0, y: 10 + 0 },
                  { x: 40 + 0, y: 10 + 8 },
                  { x: 40 + 2, y: 10 + 6 },
                  { x: 40 + 5, y: 10 + 2 },
                ],
                outline_color: { r: 1, g: 1, b: 1, a: 1 },
                outline_colors: [],
                fill_color: { r: 0, g: 0, b: 0, a: 0 },
                thickness: 2,
              },
            ],
          }),
        },
        // unrelated converter should not be shown
        {
          fromSchemaName: "MyCustomSchema",
          toSchemaName: "foxglove.SceneUpdate",
          converter: (msg) => msg,
        },
      ],
    };
    return (
      <PanelSetup fixture={fixture} includeSettings>
        <ImagePanel
          overrideConfig={{
            ...ImagePanel.defaultConfig,
            imageMode: {
              calibrationTopic: "calibration",
              imageTopic: "camera",
              annotations: [
                {
                  topic: "annotations",
                  schemaName: "foxglove.ImageAnnotations",
                  settings: { visible: true },
                },
                {
                  topic: "annotations",
                  schemaName: "foxglove_msgs/ImageAnnotations",
                  settings: { visible: true },
                },
                {
                  topic: "custom_annotations",
                  schemaName: "foxglove_msgs/ImageAnnotations",
                  settings: { visible: true },
                },
                {
                  topic: "custom_annotations",
                  schemaName: "foxglove_msgs/msg/ImageAnnotations",
                  settings: { visible: true },
                },
              ],
            },
          }}
        />
      </PanelSetup>
    );
  },
};
