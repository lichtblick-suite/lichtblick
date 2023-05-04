// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter";
import { TeapotGeometry } from "three/examples/jsm/geometries/TeapotGeometry";
import tinycolor from "tinycolor2";

import { ImageAnnotations, LineType, PointsAnnotationType, SceneUpdate } from "@foxglove/schemas";
import { MessageEvent } from "@foxglove/studio";
import { makeImageAndCalibration } from "@foxglove/studio-base/panels/ThreeDeeRender/stories/ImageMode/imageCommon";
import { xyzrpyToPose } from "@foxglove/studio-base/panels/ThreeDeeRender/transforms";
import { Topic } from "@foxglove/studio-base/players/types";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";

import { ImagePanel, ThreeDeePanel } from "../../index";
import { TransformStamped } from "../../ros";
import { QUAT_IDENTITY, makeColor } from "../common";

export default {
  title: "panels/ThreeDeeRender/Images",
  component: ThreeDeePanel,
};

const ImageWith3D = ({ imageOnlyMode }: { imageOnlyMode: boolean }) => {
  const topics: Topic[] = [
    { name: "annotations", schemaName: "foxglove.ImageAnnotations" },
    { name: "calibration", schemaName: "foxglove.CameraCalibration" },
    { name: "camera", schemaName: "foxglove.RawImage" },
    { name: "tf", schemaName: "geometry_msgs/TransformStamped" },
    { name: "sceneUpdate", schemaName: "foxglove.SceneUpdate" },
  ];

  const tfCam: MessageEvent<TransformStamped> = {
    topic: "tf",
    receiveTime: { sec: 0, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      child_frame_id: "cam",
      transform: {
        translation: { x: 0.5, y: 0, z: -10 },
        rotation: QUAT_IDENTITY,
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };
  const tfScene: MessageEvent<TransformStamped> = {
    topic: "tf",
    receiveTime: { sec: 0, nsec: 0 },
    message: {
      header: { seq: 0, stamp: { sec: 0, nsec: 0 }, frame_id: "base_link" },
      child_frame_id: "scene",
      transform: {
        translation: { x: 0, y: 0, z: 0 },
        rotation: { x: 1, y: 0, z: 0, w: 1 },
      },
    },
    schemaName: "geometry_msgs/TransformStamped",
    sizeInBytes: 0,
  };
  const annotationsMessage: MessageEvent<Partial<ImageAnnotations>> = {
    topic: "annotations",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
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

  const width = 60;
  const height = 45;

  const { calibrationMessage, cameraMessage } = makeImageAndCalibration({
    width,
    height,
    frameId: "cam",
    imageTopic: "camera",
    calibrationTopic: "calibration",
  });

  const sceneUpdateMessage = makeSceneUpdate({
    topic: "sceneUpdate",
    frameId: "scene",
  });

  const fixture: Fixture = {
    topics,
    frame: {
      annotations: [annotationsMessage],
      calibration: [calibrationMessage],
      camera: [cameraMessage],
      tf: [tfCam, tfScene],
      sceneUpdate: [sceneUpdateMessage],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  };
  /**
   * Include settings checks:
   *  - Image Only Mode On: calibration topic should have an error next to it and there should only be 1 transform (created because frame does not exist)
   *  - Image Only Mode Off: calibration topic should not have an error next to it and there should be 3 transforms
   */
  return (
    <PanelSetup fixture={fixture} includeSettings={true}>
      <ImagePanel
        overrideConfig={{
          ...ImagePanel.defaultConfig,
          followTf: undefined,
          scene: {
            transforms: {
              axisScale: 0,
              showLabel: false,
            },
          },
          imageMode: {
            calibrationTopic: imageOnlyMode ? undefined : "calibration",
            imageTopic: "camera",
            annotations: [
              {
                topic: "annotations",
                schemaName: "foxglove.ImageAnnotations",
                settings: { visible: true },
              },
            ],
          },
          topics: {
            sceneUpdate: {
              visible: true,
            },
          },
        }}
      />
    </PanelSetup>
  );
};

export const ImageOnlyModeOff: StoryObj = {
  render: () => <ImageWith3D imageOnlyMode={false} />,
  parameters: { colorScheme: "light" },
};

export const ImageOnlyModeOn: StoryObj = {
  render: () => <ImageWith3D imageOnlyMode={true} />,
  parameters: { colorScheme: "light" },
};

function makeSceneUpdate({
  topic,
  frameId,
}: {
  topic: string;
  frameId: string;
}): MessageEvent<SceneUpdate> {
  const teapotMesh = new THREE.Mesh(new TeapotGeometry(1));
  const teapotSTL = new STLExporter().parse(teapotMesh);

  /** Reorder points for testing `indices` */
  function rearrange<T>(arr: T[]): T[] {
    for (let i = 0; i + 1 < arr.length; i += 2) {
      [arr[i], arr[i + 1]] = [arr[i + 1]!, arr[i]!];
    }
    return arr;
  }
  return {
    topic,
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      deletions: [],
      entities: [
        {
          timestamp: { sec: 0, nsec: 0 },
          frame_id: frameId,
          id: "entity1",
          lifetime: { sec: 0, nsec: 0 },
          frame_locked: true,
          metadata: [],

          arrows: [
            {
              pose: xyzrpyToPose([0, 4, 0], [0, 0, 0]),
              shaft_diameter: 0.5,
              shaft_length: 0.5,
              head_diameter: 1,
              head_length: 0.3,
              color: makeColor("#f4b136", 0.5),
            },
          ],

          cubes: [
            {
              pose: xyzrpyToPose([0, 0, 0], [0, 0, 0]),
              size: { x: 0.8, y: 0.5, z: 1 },
              color: makeColor("#f4b136", 0.5),
            },
          ],

          spheres: [
            {
              pose: xyzrpyToPose([0, 6, 0], [0, 0, 0]),
              size: { x: 0.8, y: 0.5, z: 1 },
              color: makeColor("#ff6136", 0.5),
            },
          ],

          cylinders: [
            {
              pose: xyzrpyToPose([0, 5, 0], [0, 0, 0]),
              size: { x: 0.8, y: 0.5, z: 1 },
              color: makeColor("#f4b136", 0.5),
              top_scale: 1,
              bottom_scale: 0,
            },
          ],

          triangles: [],

          lines: [LineType.LINE_STRIP, LineType.LINE_LOOP, LineType.LINE_LIST].flatMap(
            (type, typeIndex) => [
              {
                // non-indexed, single color
                type,
                pose: xyzrpyToPose([0, 0.8 + typeIndex * 0.2, 0], [0, 0, 0]),
                thickness: 0.05,
                scale_invariant: false,
                points: new Array(10).fill(0).map((_, i, { length }) => ({
                  x: (0.8 * i) / (length - 1),
                  y: 0.25 * Math.sin((2 * Math.PI * i) / (length - 1)),
                  z: 0,
                })),
                color: makeColor("#7995fb", 0.8),
                colors: [],
                indices: [],
              },
              {
                // non-indexed, vertex colors
                type,
                pose: xyzrpyToPose([1, 0.8 + typeIndex * 0.2, 0], [0, 0, 0]),
                thickness: 5,
                scale_invariant: true,
                points: new Array(10).fill(0).map((_, i, { length }) => ({
                  x: (0.8 * i) / (length - 1),
                  y: 0.25 * Math.sin((2 * Math.PI * i) / (length - 1)),
                  z: 0,
                })),
                color: makeColor("#7995fb", 0.8),
                colors: new Array(10).fill(0).map((_, i, { length }) => {
                  const { r, g, b, a } = tinycolor
                    .fromRatio({ h: i / (length - 1), s: 1, v: 1 })
                    .toRgb();
                  return { r: r / 255, g: g / 255, b: b / 255, a };
                }),
                indices: [],
              },
              {
                // indexed, vertex colors
                type,
                pose: xyzrpyToPose([1, 1.8 + typeIndex * 0.2, 0], [0, 0, 0]),
                thickness: 5,
                scale_invariant: true,
                points: rearrange(
                  new Array(10).fill(0).map((_, i, { length }) => ({
                    x: (0.8 * i) / (length - 1),
                    y: 0.25 * Math.sin((2 * Math.PI * i) / (length - 1)),
                    z: 0,
                  })),
                ),
                color: makeColor("#7995fb", 0.8),
                colors: rearrange(
                  new Array(10).fill(0).map((_, i, { length }) => {
                    const { r, g, b, a } = tinycolor
                      .fromRatio({ h: i / (length - 1), s: 1, v: 1 })
                      .toRgb();
                    return { r: r / 255, g: g / 255, b: b / 255, a };
                  }),
                ),
                indices: rearrange(new Array(10).fill(0).map((_, i) => i)),
              },
              {
                // empty points
                type,
                pose: xyzrpyToPose([1, 1.8 + typeIndex * 0.2, 0], [0, 0, 0]),
                thickness: 5,
                scale_invariant: true,
                points: [],
                color: makeColor("#7995fb", 0.8),
                colors: [],
                indices: [],
              },
            ],
          ),

          texts: [
            {
              pose: xyzrpyToPose([0, 7, 0], [0, 0, 0]),
              color: makeColor("#f6f136", 0.5),
              font_size: 0.2,
              text: "3d size",
              scale_invariant: false,
              billboard: true,
            },
            {
              pose: xyzrpyToPose([1, 7, 0], [0, 0, 30]),
              color: makeColor("#ae6fc3", 0.9),
              font_size: 10,
              text: "pixel size",
              scale_invariant: true,
              billboard: true,
            },
            {
              pose: xyzrpyToPose([0, 8, 0], [0, 0, 0]),
              color: makeColor("#f6f136", 0.5),
              font_size: 0.2,
              text: "scale invariant false",
              scale_invariant: false,
              billboard: false,
            },
            {
              pose: xyzrpyToPose([1, 8, 0], [0, 0, 30]),
              color: makeColor("#ae6fc3", 0.9),
              font_size: 0.2,
              text: "scale invariant true",
              scale_invariant: true,
              billboard: false,
            },
          ],

          models: [
            {
              pose: xyzrpyToPose([0, 3, 0], [0, 0, 0]),
              scale: { x: 0.3, y: 0.2, z: 0.2 },
              color: makeColor("#59e860", 0.8),
              override_color: false,
              url: "",
              media_type: "model/stl",
              data: new TextEncoder().encode(teapotSTL),
            },
            {
              pose: xyzrpyToPose([1, 3, 0], [0, 0, 30]),
              scale: { x: 0.3, y: 0.2, z: 0.2 },
              color: makeColor("#59e860", 0.8),
              override_color: true,
              url: encodeURI(`data:model/stl;utf8,${teapotSTL}`),
              media_type: "",
              data: new Uint8Array(),
            },
          ],
        },
      ],
    },
    schemaName: "foxglove.SceneUpdate",
    sizeInBytes: 0,
  };
}
