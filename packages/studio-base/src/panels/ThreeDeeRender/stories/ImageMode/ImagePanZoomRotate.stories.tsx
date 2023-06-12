// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { fireEvent } from "@storybook/testing-library";
import * as THREE from "three";

import { ImageAnnotations, SceneUpdate } from "@foxglove/schemas";
import { MessageEvent } from "@foxglove/studio";
import { makeRawImageAndCalibration } from "@foxglove/studio-base/panels/ThreeDeeRender/stories/ImageMode/imageCommon";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";

import { ImagePanel, ThreeDeePanel } from "../../index";

export default {
  title: "panels/ThreeDeeRender/Images/PanZoomRotate",
  component: ThreeDeePanel,
  parameters: { colorScheme: "light" },
};

type BaseStoryProps = {
  rotation: 0 | 90 | 180 | 270;
  flipHorizontal: boolean;
  flipVertical: boolean;
};
const BaseStory = ({ rotation, flipHorizontal, flipVertical }: BaseStoryProps): JSX.Element => {
  const width = 60;
  const height = 45;
  const { calibrationMessage, cameraMessage } = makeRawImageAndCalibration({
    width,
    height,
    frameId: "camera",
    imageTopic: "camera",
    calibrationTopic: "calibration",

    // use fx≠fy to test that stretched images are handled correctly when panning and zooming
    fx: 500,
    fy: 700,
  });

  const annotationsMessage: MessageEvent<Partial<ImageAnnotations>> = {
    topic: "annotations",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      circles: [
        {
          timestamp: { sec: 0, nsec: 0 },
          position: { x: 10, y: 5 },
          diameter: 2,
          thickness: 0.5,
          fill_color: { r: 1, g: 0, b: 1, a: 1 },
          outline_color: { r: 1, g: 1, b: 0, a: 1 },
        },
      ],
    },
    schemaName: "foxglove.ImageAnnotations",
    sizeInBytes: 0,
  };

  const sceneUpdateMessage: MessageEvent<Partial<SceneUpdate>> = {
    topic: "scene",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      entities: [
        {
          timestamp: { sec: 10, nsec: 0 },
          frame_id: "camera",
          id: "x",
          lifetime: { sec: 0, nsec: 0 },
          frame_locked: true,
          metadata: [],
          arrows: [],
          cubes: [
            {
              pose: {
                position: { x: 2, y: 1.5, z: 50 },
                orientation: new THREE.Quaternion().setFromAxisAngle(
                  new THREE.Vector3(0, 1, 0),
                  Math.PI / 4,
                ),
              },
              color: { r: 1, g: 1, b: 0, a: 0.5 },
              size: { x: 1, y: 1, z: 1 },
            },
          ],
          spheres: [],
          cylinders: [],
          lines: [],
          triangles: [],
          texts: [],
          models: [],
        },
      ],
    },
    schemaName: "foxglove.SceneUpdate",
    sizeInBytes: 0,
  };

  const fixture: Fixture = {
    topics: [
      { name: "calibration", schemaName: "foxglove.CameraCalibration" },
      { name: "camera", schemaName: "foxglove.RawImage" },
      { name: "annotations", schemaName: "foxglove.ImageAnnotations" },
      { name: "scene", schemaName: "foxglove.SceneUpdate" },
    ],
    frame: {
      calibration: [calibrationMessage],
      camera: [cameraMessage],
      annotations: [annotationsMessage],
      scene: [sceneUpdateMessage],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  };
  return (
    // Use a fixed-size container to make the canvas size/position consistent for mouse interactions
    <div style={{ width: 800, height: 600, flex: "0 0 auto" }}>
      <PanelSetup fixture={fixture} includeSettings={true} settingsWidth={338}>
        <ImagePanel
          overrideConfig={{
            ...ImagePanel.defaultConfig,
            imageMode: {
              calibrationTopic: "calibration",
              imageTopic: "camera",
              annotations: { annotations: { visible: true } },
              rotation,
              flipHorizontal,
              flipVertical,
            },
            topics: {
              scene: { visible: true },
            },
          }}
        />
      </PanelSetup>
    </div>
  );
};

function makeMouseMarker(parent: HTMLElement) {
  const mouseMarker = document.createElement("div");
  mouseMarker.style.position = "absolute";
  mouseMarker.style.width = "10px";
  mouseMarker.style.height = "10px";
  mouseMarker.style.borderRadius = "5px";
  mouseMarker.style.backgroundColor = "green";
  parent.appendChild(mouseMarker);
  return mouseMarker;
}

export const PanZoom: StoryObj<
  BaseStoryProps & { dx: number; dy: number; panX: number; panY: number }
> = {
  render: BaseStory,
  args: {
    dx: 79,
    dy: 189,
    panX: 100,
    panY: 50,
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = document.querySelector("canvas")!;
    const rect = canvas.getBoundingClientRect();
    const mouseMarker = makeMouseMarker(canvasElement);

    const cx = rect.left + args.dx;
    const cy = rect.top + args.dy;

    function setMarkerPos(x: number, y: number) {
      mouseMarker.style.left = `${x - 5}px`;
      mouseMarker.style.top = `${y - 5}px`;
    }

    setMarkerPos(cx, cy);
    fireEvent.mouseDown(canvas, { clientX: cx, clientY: cy });

    setMarkerPos(cx + args.panX, cy + args.panY);
    fireEvent.mouseMove(canvas, { clientX: cx + args.panX, clientY: cy + args.panY });
    fireEvent.mouseUp(canvas, { clientX: cx + args.panX, clientY: cy + args.panY });

    fireEvent.wheel(canvas, { clientX: cx + args.panX, clientY: cy + args.panY, deltaY: 100 });

    // pan again after zooming to ensure the zoom scale is accounted for
    fireEvent.mouseDown(canvas, { clientX: cx + args.panX, clientY: cy + args.panY });
    setMarkerPos(cx + args.panX * 0.3, cy + args.panY * 0.3);
    fireEvent.mouseMove(canvas, { clientX: cx + args.panX * 0.3, clientY: cy + args.panY * 0.3 });
    fireEvent.mouseUp(canvas, { clientX: cx + args.panX * 0.3, clientY: cy + args.panY * 0.3 });
  },
};

export const PanZoomFlipH: typeof PanZoom = {
  ...PanZoom,
  args: {
    dx: 387,
    dy: 189,
    panX: -100,
    panY: 50,
    rotation: 0,
    flipHorizontal: true,
    flipVertical: false,
  },
};

export const PanZoomFlipV: typeof PanZoom = {
  ...PanZoom,
  args: {
    dx: 79,
    dy: 382,
    panX: 100,
    panY: 50,
    rotation: 0,
    flipHorizontal: false,
    flipVertical: true,
  },
};

export const PanZoom90: typeof PanZoom = {
  ...PanZoom,
  args: {
    dx: 352,
    dy: 96,
    panX: 100,
    panY: 50,
    rotation: 90,
    flipHorizontal: false,
    flipVertical: false,
  },
};

export const PanZoom90FlipH: typeof PanZoom = {
  ...PanZoom,
  args: {
    dx: 115,
    dy: 96,
    panX: 100,
    panY: 50,
    rotation: 90,
    flipHorizontal: true,
    flipVertical: false,
  },
};

export const PanZoom90FlipV: typeof PanZoom = {
  ...PanZoom,
  args: {
    dx: 352,
    dy: 476,
    panX: -100,
    panY: -50,
    rotation: 90,
    flipHorizontal: false,
    flipVertical: true,
  },
};

export const PanZoom180: typeof PanZoom = {
  ...PanZoom,
  args: {
    dx: 387,
    dy: 382,
    panX: -100,
    panY: 50,
    rotation: 180,
    flipHorizontal: false,
    flipVertical: false,
  },
};

export const PanZoom270: typeof PanZoom = {
  ...PanZoom,
  args: {
    dx: 115,
    dy: 476,
    panX: 100,
    panY: -50,
    rotation: 270,
    flipHorizontal: false,
    flipVertical: false,
  },
};
