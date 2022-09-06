// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter";
import { TeapotGeometry } from "three/examples/jsm/geometries/TeapotGeometry";
import tinycolor from "tinycolor2";

import { FrameTransform, LineType, SceneUpdate } from "@foxglove/schemas/schemas/typescript";
import { MessageEvent, Topic } from "@foxglove/studio";
import { xyzrpyToPose } from "@foxglove/studio-base/panels/ThreeDeeRender/transforms";
import PanelSetup from "@foxglove/studio-base/stories/PanelSetup";

import ThreeDeeRender from "../index";
import { makeColor, QUAT_IDENTITY, rad2deg } from "./common";

export default {
  title: "panels/ThreeDeeRender/SceneEntities",
  component: ThreeDeeRender,
};

function makeStoryScene({
  topic,
  frameId,
}: {
  topic: string;
  frameId: string;
}): MessageEvent<SceneUpdate> {
  const teapotMesh = new THREE.Mesh(new TeapotGeometry(1));
  teapotMesh.rotateX(Math.PI / 2);
  teapotMesh.updateMatrixWorld();
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
            {
              pose: xyzrpyToPose([1, 4, 0], [0, 0, 30]),
              shaft_diameter: 0.5,
              shaft_length: 0.5,
              head_diameter: 1,
              head_length: 0.3,
              color: makeColor("#afe663", 0.9),
            },
          ],

          cubes: [
            {
              pose: xyzrpyToPose([0, 0, 0], [0, 0, 0]),
              size: { x: 0.8, y: 0.5, z: 1 },
              color: makeColor("#f4b136", 0.5),
            },
            {
              pose: xyzrpyToPose([1, 0, 0], [0, 0, 30]),
              size: { x: 0.4, y: 0.2, z: 1 },
              color: makeColor("#afe663", 0.9),
            },
          ],

          spheres: [],

          cylinders: [
            {
              pose: xyzrpyToPose([0, 5, 0], [0, 0, 0]),
              size: { x: 0.8, y: 0.5, z: 1 },
              color: makeColor("#f4b136", 0.5),
              top_scale: 1,
              bottom_scale: 0,
            },
            {
              pose: xyzrpyToPose([1, 5, 0], [0, 0, 30]),
              size: { x: 0.4, y: 0.2, z: 1 },
              color: makeColor("#afe663", 0.9),
              top_scale: 0.25,
              bottom_scale: 0.75,
            },
          ],

          lines: [
            0 as LineType.LINE_STRIP,
            1 as LineType.LINE_LOOP,
            2 as LineType.LINE_LIST,
          ].flatMap((type, typeIndex) => [
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
              // indexed, single color
              type,
              pose: xyzrpyToPose([0, 1.8 + typeIndex * 0.2, 0], [0, 0, 0]),
              thickness: 0.05,
              scale_invariant: false,
              points: rearrange(
                new Array(10).fill(0).map((_, i, { length }) => ({
                  x: (0.8 * i) / (length - 1),
                  y: 0.25 * Math.sin((2 * Math.PI * i) / (length - 1)),
                  z: 0,
                })),
              ),
              color: makeColor("#7995fb", 0.8),
              colors: [],
              indices: rearrange(new Array(10).fill(0).map((_, i) => i)),
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
          ]),

          triangles: [],

          texts: [],

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
    sizeInBytes: 0,
  };
}

BasicEntities.parameters = { colorScheme: "light", chromatic: { delay: 100 } };
export function BasicEntities(): JSX.Element {
  const topics: Topic[] = [
    { name: "transforms", datatype: "foxglove.FrameTransform" },
    { name: "scene1", datatype: "foxglove.SceneUpdate" },
    { name: "scene2", datatype: "foxglove.SceneUpdate" },
  ];

  const scene1 = makeStoryScene({ topic: "scene1", frameId: "frame1" });
  const scene2 = makeStoryScene({ topic: "scene2", frameId: "frame2" });

  const tf1: MessageEvent<FrameTransform> = {
    topic: "transforms",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      parent_frame_id: "map",
      child_frame_id: "root",
      translation: { x: 1e7, y: 0, z: 0 },
      rotation: QUAT_IDENTITY,
    },
    sizeInBytes: 0,
  };
  const tf2: MessageEvent<FrameTransform> = {
    topic: "transforms",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      parent_frame_id: "root",
      child_frame_id: "frame1",
      translation: { x: -4, y: -4, z: 0 },
      rotation: QUAT_IDENTITY,
    },
    sizeInBytes: 0,
  };
  const tf3: MessageEvent<FrameTransform> = {
    topic: "transforms",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      timestamp: { sec: 0, nsec: 0 },
      parent_frame_id: "root",
      child_frame_id: "frame2",
      translation: { x: 0, y: -4, z: 0 },
      rotation: QUAT_IDENTITY,
    },
    sizeInBytes: 0,
  };

  const fixture = {
    topics,
    frame: {
      transforms: [tf1, tf2, tf3],
      scene1: [scene1],
      scene2: [scene2],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  };

  return (
    <PanelSetup fixture={fixture}>
      <ThreeDeeRender
        overrideConfig={{
          ...ThreeDeeRender.defaultConfig,
          followTf: "root",
          layers: {
            grid: { layerId: "foxglove.Grid" },
          },
          cameraState: {
            distance: 12,
            perspective: true,
            phi: 30,
            targetOffset: [0, -2, 0],
            thetaOffset: rad2deg(-0.25),
            fovy: 45,
            near: 0.01,
            far: 5000,
            target: [0, 0, 0],
            targetOrientation: [0, 0, 0, 1],
          },
          topics: {
            scene1: { visible: true },
            scene2: { visible: true, color: "#6324c7ff" },
          },
        }}
      />
    </PanelSetup>
  );
}
