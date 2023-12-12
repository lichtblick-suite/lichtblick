// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as _ from "lodash-es";
import { DeepPartial } from "ts-essentials";

import { fromNanoSec } from "@foxglove/rostime";
import {
  CameraCalibration,
  CircleAnnotation,
  ImageAnnotations,
  PointsAnnotation,
  RawImage,
  TextAnnotation,
} from "@foxglove/schemas";
import { MessageEvent } from "@foxglove/studio";
import { HUDItemManager } from "@foxglove/studio-base/panels/ThreeDeeRender/HUDItemManager";
import {
  MessageHandler,
  WAITING_FOR_BOTH_HUD_ITEM,
  WAITING_FOR_CALIBRATION_HUD_ITEM,
  WAITING_FOR_IMAGE_EMPTY_HUD_ITEM,
  WAITING_FOR_IMAGE_NOTICE_HUD_ITEM,
  WAITING_FOR_SYNC_EMPTY_HUD_ITEM,
  WAITING_FOR_SYNC_NOTICE_HUD_ITEM,
} from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/ImageMode/MessageHandler";

import { PartialMessageEvent } from "../../SceneExtension";

function wrapInMessageEvent<T>(
  topic: string,
  schema: string,
  time: bigint,
  message?: T | Partial<T>,
): PartialMessageEvent<T> {
  return {
    message: (message ?? {}) as DeepPartial<T>,
    topic,
    schemaName: schema,
    receiveTime: fromNanoSec(time),
    sizeInBytes: 0,
  };
}

describe("MessageHandler: synchronized = false", () => {
  it("should return an empty state if no messages are handled", () => {
    const hud = new HUDItemManager(() => {});
    const initConfig = { synchronize: false };
    const messageHandler = new MessageHandler(initConfig, hud);

    const state = messageHandler.getRenderStateAndUpdateHUD();

    expect(state).toEqual({
      annotationsByTopic: new Map(),
    });
  });

  it("should have camera info if handled camera info", () => {
    const hud = new HUDItemManager(() => {});
    const initConfig = { synchronize: false, calibrationTopic: "exists" };
    const messageHandler = new MessageHandler(initConfig, hud);

    const cameraInfo = wrapInMessageEvent<CameraCalibration>(
      "calibration",
      "foxglove.CameraCalibration",
      0n,
    );
    messageHandler.handleCameraInfo(cameraInfo);
    const state = messageHandler.getRenderStateAndUpdateHUD();

    expect(state.cameraInfo).not.toBeUndefined();
    expect(_.sortBy(hud.getHUDItems(), (item) => item.id)).toEqual([
      WAITING_FOR_IMAGE_NOTICE_HUD_ITEM, // notice because camera info exists
    ]);
  });
  it("should have image if handled image", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      { synchronize: false, calibrationTopic: "info" },
      hud,
    );

    const image = wrapInMessageEvent<RawImage>("image", "foxglove.RawImage", 0n);
    messageHandler.handleRawImage(image);
    const state = messageHandler.getRenderStateAndUpdateHUD();

    expect(state.image).not.toBeUndefined();
    expect(
      hud.getHUDItems().find((item) => item.id === WAITING_FOR_CALIBRATION_HUD_ITEM.id),
    ).toBeTruthy();
  });

  it("should have annotations if handled annotations", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      {
        synchronize: false,
        annotations: { annotations: { visible: true } },
      },
      hud,
    );

    const annotation = createCircleAnnotations([0n]);
    const annotationMessage = wrapInMessageEvent(
      "annotations",
      "foxglove.ImageAnnotations",
      0n,
      annotation,
    );
    messageHandler.handleAnnotations(annotationMessage as MessageEvent<ImageAnnotations>);
    const state = messageHandler.getRenderStateAndUpdateHUD();

    expect(state.annotationsByTopic?.get("annotations")).not.toBeUndefined();
  });
  it("clears image if image topic changed", () => {
    const hud = new HUDItemManager(() => {});
    const initConfig = { synchronize: false, imageTopic: "image1" };
    const messageHandler = new MessageHandler(initConfig, hud);

    const image = wrapInMessageEvent<RawImage>("image1", "foxglove.RawImage", 0n);
    messageHandler.handleRawImage(image);

    messageHandler.setConfig({ ...initConfig, imageTopic: "image2" });
    const state = messageHandler.getRenderStateAndUpdateHUD();

    expect(state.image).toBeUndefined();
  });
  it("clears cameraInfo if calibration topic changed", () => {
    const hud = new HUDItemManager(() => {});
    const initConfig = {
      synchronize: false,
      calibrationTopic: "calibration1",
    };
    const messageHandler = new MessageHandler(initConfig, hud);

    const cameraInfo = wrapInMessageEvent<CameraCalibration>(
      "calibration1",
      "foxglove.CameraCalibration",
      0n,
    );
    messageHandler.handleCameraInfo(cameraInfo);
    messageHandler.setConfig({ ...initConfig, calibrationTopic: "calibration2" });
    const state = messageHandler.getRenderStateAndUpdateHUD();

    expect(state.cameraInfo).toBeUndefined();
  });
  it("clears cameraInfo if calibration set to undefined", () => {
    const hud = new HUDItemManager(() => {});
    const initConfig = {
      synchronize: false,
      calibrationTopic: "calibration1",
    };
    const messageHandler = new MessageHandler(initConfig, hud);

    const cameraInfo = wrapInMessageEvent<CameraCalibration>(
      "calibration1",
      "foxglove.CameraCalibration",
      0n,
    );
    messageHandler.handleCameraInfo(cameraInfo);
    messageHandler.setConfig({ ...initConfig, calibrationTopic: undefined });
    const state = messageHandler.getRenderStateAndUpdateHUD();

    expect(state.cameraInfo).toBeUndefined();
  });
  it("clears specific annotations if annotations subscriptions change", () => {
    const hud = new HUDItemManager(() => {});
    const initConfig = {
      synchronize: false,
      annotations: {
        annotations1: { visible: true },
        annotations2: { visible: true },
      },
    };
    const messageHandler = new MessageHandler(initConfig, hud);

    const annotation = createCircleAnnotations([0n]);
    const annotation1Message = wrapInMessageEvent(
      "annotations1",
      "foxglove.ImageAnnotations",
      0n,
      annotation,
    );
    const annotation2Message = wrapInMessageEvent(
      "annotations2",
      "foxglove.ImageAnnotations",
      0n,
      annotation,
    );
    messageHandler.handleAnnotations(annotation1Message as MessageEvent<ImageAnnotations>);
    messageHandler.handleAnnotations(annotation2Message as MessageEvent<ImageAnnotations>);

    // annotations2 removed
    messageHandler.setConfig({
      ...initConfig,
      annotations: { annotations1: { visible: true }, annotations2: { visible: false } },
    });
    const state = messageHandler.getRenderStateAndUpdateHUD();

    expect(state.annotationsByTopic?.get("annotations1")).not.toBeUndefined();
    expect(state.annotationsByTopic?.get("annotations2")).toBeUndefined();
  });
  it("listener function called whenever a message is handled or when config changes", () => {
    const hud = new HUDItemManager(() => {});
    const initConfig = {
      synchronize: false,
      imageTopic: "image",
      calibrationTopic: "calibration",
      annotations: { annotations: { visible: true } },
    };
    const messageHandler = new MessageHandler(initConfig, hud);
    const listener = jest.fn();

    messageHandler.addListener(listener);

    const image = wrapInMessageEvent<RawImage>("image", "foxglove.RawImage", 0n);
    messageHandler.handleRawImage(image);

    const cameraInfo = wrapInMessageEvent<CameraCalibration>(
      "calibration",
      "foxglove.CameraCalibration",
      0n,
    );
    messageHandler.handleCameraInfo(cameraInfo);

    const annotation = createCircleAnnotations([0n]);
    const annotationMessage = wrapInMessageEvent(
      "annotations",
      "foxglove.ImageAnnotations",
      0n,
      annotation,
    );
    messageHandler.handleAnnotations(annotationMessage as MessageEvent<ImageAnnotations>);

    // annotations2 removed
    messageHandler.setConfig({ ...initConfig, annotations: { annotations: { visible: false } } });
    expect(listener).toHaveBeenCalledTimes(4);
  });
  it("should keep image and camera info if switching from unsync to sync to sync", () => {
    const hud = new HUDItemManager(() => {});
    const initConfig = { synchronize: false, imageTopic: "image", calibrationTopic: "calib" };
    const messageHandler = new MessageHandler(initConfig, hud);
    const listener = jest.fn();

    messageHandler.addListener(listener);
    const image = wrapInMessageEvent<RawImage>("image", "foxglove.RawImage", 0n);
    messageHandler.handleRawImage(image);

    const cameraInfo = wrapInMessageEvent<CameraCalibration>(
      "calibration",
      "foxglove.CameraCalibration",
      0n,
    );
    messageHandler.handleCameraInfo(cameraInfo);
    expect(listener).toHaveBeenCalledTimes(2);

    messageHandler.setConfig({ ...initConfig, synchronize: true, calibrationTopic: "calib" });

    expect(listener).toHaveBeenCalledTimes(3);
    const state = messageHandler.getRenderStateAndUpdateHUD();
    expect(state.image).not.toBeUndefined();
    expect(state.cameraInfo).not.toBeUndefined();
  });
});

describe("MessageHandler: synchronized = true", () => {
  it("handles and shows camera info in state", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      { synchronize: true, calibrationTopic: "calibration" },
      hud,
    );

    const cameraInfo = wrapInMessageEvent<CameraCalibration>(
      "calibration",
      "foxglove.CameraCalibration",
      0n,
    );
    messageHandler.handleCameraInfo(cameraInfo);
    const state = messageHandler.getRenderStateAndUpdateHUD();

    expect(state.cameraInfo).not.toBeUndefined();
  });

  it("handles and shows image in state with no active annotations", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler({ synchronize: true }, hud);

    const image = wrapInMessageEvent<RawImage>("image", "foxglove.RawImage", 0n);
    messageHandler.handleRawImage(image);
    const state = messageHandler.getRenderStateAndUpdateHUD();

    expect(state.image).not.toBeUndefined();
  });

  it("does not show state with annotations if only handled annotations", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      {
        synchronize: true,
        annotations: { annotations: { visible: true } },
      },
      hud,
    );

    const annotation = createCircleAnnotations([0n]);
    const annotationMessage = wrapInMessageEvent(
      "annotations",
      "foxglove.ImageAnnotations",
      0n,
      annotation,
    );
    messageHandler.handleAnnotations(annotationMessage as MessageEvent<ImageAnnotations>);
    const state = messageHandler.getRenderStateAndUpdateHUD();

    expect(state.annotationsByTopic?.get("annotations")).toBeUndefined();
    expect(state.presentAnnotationTopics).toBeUndefined();
    expect(state.missingAnnotationTopics).toBeUndefined();
  });

  it("shows state with image and annotations if they have the same timestamp", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      {
        synchronize: true,
        annotations: { annotations: { visible: true } },
      },
      hud,
    );
    const time = 2n;

    const image = wrapInMessageEvent<RawImage>("image", "foxglove.RawImage", 0n, {
      timestamp: fromNanoSec(time),
    });

    const annotation = createCircleAnnotations([time]);
    const annotationMessage = wrapInMessageEvent(
      "annotations",
      "foxglove.ImageAnnotations",
      0n,
      annotation,
    );

    messageHandler.handleRawImage(image);
    messageHandler.handleAnnotations(annotationMessage as MessageEvent<ImageAnnotations>);
    const state = messageHandler.getRenderStateAndUpdateHUD();

    expect(state.image).not.toBeUndefined();
    expect(state.annotationsByTopic?.get("annotations")).not.toBeUndefined();
    expect(state.presentAnnotationTopics).toBeUndefined();
    expect(state.missingAnnotationTopics).toBeUndefined();
  });

  it("shows state without image and annotations if they have different header timestamps", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      {
        synchronize: true,
        annotations: {
          annotations1: { visible: true },
          annotations2: { visible: true },
        },
      },
      hud,
    );
    const time = 2n;

    const image = wrapInMessageEvent<RawImage>("image", "foxglove.RawImage", 0n, {
      timestamp: fromNanoSec(time),
    });

    const annotation1 = createCircleAnnotations([time]);
    const annotationMessage1 = wrapInMessageEvent(
      "annotations1",
      "foxglove.ImageAnnotations",
      0n,
      annotation1,
    );
    const annotation2 = createCircleAnnotations([time + 1n]);
    const annotationMessage2 = wrapInMessageEvent(
      "annotations2",
      "foxglove.ImageAnnotations",
      0n,
      annotation2,
    );

    messageHandler.handleRawImage(image);
    messageHandler.handleAnnotations(annotationMessage1 as MessageEvent<ImageAnnotations>);
    messageHandler.handleAnnotations(annotationMessage2 as MessageEvent<ImageAnnotations>);
    const state = messageHandler.getRenderStateAndUpdateHUD();

    expect(state.image).toBeUndefined();
    expect(state.annotationsByTopic?.get("annotations1")).toBeUndefined();
    expect(state.annotationsByTopic?.get("annotations2")).toBeUndefined();
    expect(state.presentAnnotationTopics).toEqual(["annotations1"]);
    expect(state.missingAnnotationTopics).toEqual(["annotations2"]);
  });

  it("shows most recent image and annotations with same timestamps", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      {
        synchronize: true,
        annotations: { annotations: { visible: true } },
      },
      hud,
    );
    let time = 2n;

    let image = wrapInMessageEvent<RawImage>("image", "foxglove.RawImage", 0n, {
      timestamp: fromNanoSec(time),
    });

    let annotation = createCircleAnnotations([time]);
    let annotationMessage = wrapInMessageEvent(
      "annotations",
      "foxglove.ImageAnnotations",
      0n,
      annotation,
    );

    messageHandler.handleRawImage(image);
    messageHandler.handleAnnotations(annotationMessage as MessageEvent<ImageAnnotations>);

    time = 4n;

    image = wrapInMessageEvent<RawImage>("image", "foxglove.RawImage", 1n, {
      timestamp: fromNanoSec(time),
    });

    annotation = createCircleAnnotations([time]);
    annotationMessage = wrapInMessageEvent(
      "annotations",
      "foxglove.ImageAnnotations",
      1n,
      annotation,
    );

    messageHandler.handleRawImage(image);
    messageHandler.handleAnnotations(annotationMessage as MessageEvent<ImageAnnotations>);
    const state = messageHandler.getRenderStateAndUpdateHUD();

    expect((state.image?.message as RawImage).timestamp).toEqual(fromNanoSec(time));
    expect(state.annotationsByTopic?.get("annotations")?.annotations[0]?.stamp).toEqual(
      fromNanoSec(time),
    );
  });

  it("shows most older image and annotations with same timestamps if newer messages have different timestamps", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      {
        synchronize: true,
        annotations: { annotations: { visible: true } },
      },
      hud,
    );

    const time = 2n;

    let image = wrapInMessageEvent<RawImage>("image", "foxglove.RawImage", 0n, {
      timestamp: fromNanoSec(time),
    });

    let annotation = createCircleAnnotations([time]);
    let annotationMessage = wrapInMessageEvent(
      "annotations",
      "foxglove.ImageAnnotations",
      0n,
      annotation,
    );

    messageHandler.handleRawImage(image);
    messageHandler.handleAnnotations(annotationMessage as MessageEvent<ImageAnnotations>);

    // different timestamp messages
    image = wrapInMessageEvent<RawImage>("image", "foxglove.RawImage", 1n, {
      timestamp: fromNanoSec(3n),
    });

    annotation = createCircleAnnotations([4n]);
    annotationMessage = wrapInMessageEvent(
      "annotations",
      "foxglove.ImageAnnotations",
      1n,
      annotation,
    );

    messageHandler.handleRawImage(image);
    messageHandler.handleAnnotations(annotationMessage as MessageEvent<ImageAnnotations>);

    const state = messageHandler.getRenderStateAndUpdateHUD();

    expect((state.image?.message as RawImage).timestamp).toEqual(fromNanoSec(time));
    expect(state.annotationsByTopic?.get("annotations")?.annotations[0]?.stamp).toEqual(
      fromNanoSec(time),
    );
  });

  it("does not show image in state if it hasn't received requisite annotations at same timestamp", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      {
        synchronize: true,
        annotations: { annotations1: { visible: true }, annotations2: { visible: true } },
      },
      hud,
    );
    const time = 2n;

    const image = wrapInMessageEvent<RawImage>("image", "foxglove.RawImage", 0n, {
      timestamp: fromNanoSec(time),
    });

    const annotation = createCircleAnnotations([time]);
    const annotationMessage = wrapInMessageEvent(
      "annotations1",
      "foxglove.ImageAnnotations",
      0n,
      annotation,
    );

    messageHandler.handleRawImage(image);
    messageHandler.handleAnnotations(annotationMessage as MessageEvent<ImageAnnotations>);

    const state = messageHandler.getRenderStateAndUpdateHUD();

    expect(state.image).toBeUndefined();
    expect(state.annotationsByTopic).toBeUndefined();
  });

  it("clears image when image topic changed", () => {
    const hud = new HUDItemManager(() => {});
    const initConfig = {
      imageTopic: "image1",
      synchronize: true,
      annotations: { annotations: { visible: true } },
    };
    const messageHandler = new MessageHandler(initConfig, hud);
    const time = 2n;

    const image = wrapInMessageEvent<RawImage>("image1", "foxglove.RawImage", 0n, {
      timestamp: fromNanoSec(time),
    });

    const annotation = createCircleAnnotations([time]);
    const annotationMessage = wrapInMessageEvent(
      "annotations",
      "foxglove.ImageAnnotations",
      0n,
      annotation,
    );

    messageHandler.handleRawImage(image);
    messageHandler.handleAnnotations(annotationMessage as MessageEvent<ImageAnnotations>);
    messageHandler.setConfig({ ...initConfig, imageTopic: "image2" });
    const state = messageHandler.getRenderStateAndUpdateHUD();
    expect(state.image).toBeUndefined();
  });
  it("clears specific annotations if annotations subscriptions change", () => {
    const hud = new HUDItemManager(() => {});
    const initConfig = {
      synchronize: true,
      imageTopic: "image",
      calibrationTopic: "calibration",
      annotations: {
        annotations1: { visible: true },
        annotations2: { visible: true },
      },
    };
    const messageHandler = new MessageHandler(initConfig, hud);
    const time = 2n;

    const image = wrapInMessageEvent<RawImage>("image1", "foxglove.RawImage", 0n, {
      timestamp: fromNanoSec(time),
    });

    messageHandler.handleRawImage(image);

    const annotation = createCircleAnnotations([time]);
    const annotation1Message = wrapInMessageEvent(
      "annotations1",
      "foxglove.ImageAnnotations",
      0n,
      annotation,
    );
    const annotation2Message = wrapInMessageEvent(
      "annotations2",
      "foxglove.ImageAnnotations",
      0n,
      annotation,
    );
    messageHandler.handleAnnotations(annotation1Message as MessageEvent<ImageAnnotations>);
    messageHandler.handleAnnotations(annotation2Message as MessageEvent<ImageAnnotations>);

    // annotations2 removed
    messageHandler.setConfig({
      ...initConfig,
      annotations: { annotations1: { visible: true }, annotations2: { visible: false } },
      calibrationTopic: "calibration",
    });
    const state = messageHandler.getRenderStateAndUpdateHUD();

    expect(state.annotationsByTopic?.get("annotations1")).not.toBeUndefined();
    expect(state.annotationsByTopic?.get("annotations2")).toBeUndefined();
  });
  it("listener function called whenever a message is handled or when config changes", () => {
    const hud = new HUDItemManager(() => {});
    const initConfig = {
      synchronize: true,
      imageTopic: "image",
      calibrationTopic: "calibration",
      annotations: { annotations: { visible: true } },
    };
    const messageHandler = new MessageHandler(initConfig, hud);
    const listener = jest.fn();

    messageHandler.addListener(listener);

    const image = wrapInMessageEvent<RawImage>("image", "foxglove.RawImage", 0n);
    messageHandler.handleRawImage(image);

    const cameraInfo = wrapInMessageEvent<CameraCalibration>(
      "calibration",
      "foxglove.CameraCalibration",
      0n,
    );
    messageHandler.handleCameraInfo(cameraInfo);

    const annotation = createCircleAnnotations([0n]);
    const annotationMessage = wrapInMessageEvent(
      "annotations",
      "foxglove.ImageAnnotations",
      0n,
      annotation,
    );
    messageHandler.handleAnnotations(annotationMessage as MessageEvent<ImageAnnotations>);

    // annotations2 removed
    messageHandler.setConfig({
      ...initConfig,
      annotations: { annotations: { visible: false } },
      calibrationTopic: "calibration",
    });
    expect(listener).toHaveBeenCalledTimes(4);
  });
});

describe("MessageHandler: hud item display", () => {
  it("init: waiting for images if no calibration topic specified", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler({ synchronize: false }, hud);

    messageHandler.getRenderStateAndUpdateHUD();

    const hudItems = _.sortBy(hud.getHUDItems(), "id");
    expect(hudItems).toEqual([WAITING_FOR_IMAGE_EMPTY_HUD_ITEM]);
  });
  it("init: waiting for both if calibration topic specified", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      { synchronize: false, calibrationTopic: "exists" },
      hud,
    );

    messageHandler.getRenderStateAndUpdateHUD();

    const hudItems = _.sortBy(hud.getHUDItems(), "id");
    expect(hudItems).toEqual([WAITING_FOR_BOTH_HUD_ITEM, WAITING_FOR_IMAGE_NOTICE_HUD_ITEM]);
  });
  it("waiting for image notice if calibration received", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      { synchronize: false, calibrationTopic: "exists" },
      hud,
    );

    const cameraInfo = wrapInMessageEvent<CameraCalibration>(
      "calibration",
      "foxglove.CameraCalibration",
      0n,
    );
    messageHandler.handleCameraInfo(cameraInfo);
    messageHandler.getRenderStateAndUpdateHUD();

    const hudItems = _.sortBy(hud.getHUDItems(), "id");
    expect(hudItems).toEqual([WAITING_FOR_IMAGE_NOTICE_HUD_ITEM]);
  });
  it("is waiting for calibration if topic specified and image received", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      { synchronize: false, calibrationTopic: "info" },
      hud,
    );

    const image = wrapInMessageEvent<RawImage>("image", "foxglove.RawImage", 0n);
    messageHandler.handleRawImage(image);
    messageHandler.getRenderStateAndUpdateHUD();

    const hudItems = _.sortBy(hud.getHUDItems(), "id");
    expect(hudItems).toEqual([WAITING_FOR_CALIBRATION_HUD_ITEM]);
  });

  it("is waiting for image if image topic is changed after recieving image", () => {
    const hud = new HUDItemManager(() => {});
    const initConfig = { synchronize: false, imageTopic: "image1" };
    const messageHandler = new MessageHandler(initConfig, hud);

    const image = wrapInMessageEvent<RawImage>("image1", "foxglove.RawImage", 0n);
    messageHandler.handleRawImage(image);

    messageHandler.setConfig({ ...initConfig, imageTopic: "image2" });
    messageHandler.getRenderStateAndUpdateHUD();

    const hudItems = _.sortBy(hud.getHUDItems(), "id");
    expect(hudItems).toEqual([WAITING_FOR_IMAGE_EMPTY_HUD_ITEM]);
  });

  it("shows waiting for Both if calibration topic changed after only receiving calibration message", () => {
    const hud = new HUDItemManager(() => {});
    const initConfig = {
      synchronize: false,
      calibrationTopic: "calibration1",
    };
    const messageHandler = new MessageHandler(initConfig, hud);

    const cameraInfo = wrapInMessageEvent<CameraCalibration>(
      "calibration1",
      "foxglove.CameraCalibration",
      0n,
    );
    messageHandler.handleCameraInfo(cameraInfo);
    messageHandler.setConfig({ ...initConfig, calibrationTopic: "calibration2" });
    messageHandler.getRenderStateAndUpdateHUD();

    const hudItems = _.sortBy(hud.getHUDItems(), "id").filter(
      (item) => item.displayType === "empty",
    );
    expect(hudItems).toEqual([WAITING_FOR_BOTH_HUD_ITEM]);
  });

  it("shows waiting for calibration if calibration topic changed after receiving both image and calibration messages", () => {
    const hud = new HUDItemManager(() => {});
    const initConfig = {
      synchronize: false,
      calibrationTopic: "calibration1",
    };
    const messageHandler = new MessageHandler(initConfig, hud);

    const cameraInfo = wrapInMessageEvent<CameraCalibration>(
      "calibration1",
      "foxglove.CameraCalibration",
      0n,
    );
    messageHandler.handleCameraInfo(cameraInfo);

    const image = wrapInMessageEvent<RawImage>("image1", "foxglove.RawImage", 0n);
    messageHandler.handleRawImage(image);

    messageHandler.setConfig({ ...initConfig, calibrationTopic: "calibration2" });

    messageHandler.getRenderStateAndUpdateHUD();

    const hudItems = _.sortBy(hud.getHUDItems(), "id");
    expect(hudItems).toEqual([WAITING_FOR_CALIBRATION_HUD_ITEM]);
  });
  it("displays waiting for image after calibration is set to undefined", () => {
    const hud = new HUDItemManager(() => {});
    const initConfig = {
      synchronize: false,
      calibrationTopic: "calibration1",
    };
    const messageHandler = new MessageHandler(initConfig, hud);

    const cameraInfo = wrapInMessageEvent<CameraCalibration>(
      "calibration1",
      "foxglove.CameraCalibration",
      0n,
    );
    messageHandler.handleCameraInfo(cameraInfo);
    messageHandler.setConfig({ ...initConfig, calibrationTopic: undefined });
    messageHandler.getRenderStateAndUpdateHUD();

    const hudItems = _.sortBy(hud.getHUDItems(), "id").filter(
      ({ displayType }) => displayType === "empty",
    );
    expect(hudItems).toEqual([WAITING_FOR_IMAGE_EMPTY_HUD_ITEM]);
  });

  it("displays no info after receiving calibration and image", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      { synchronize: false, calibrationTopic: "calibration" },
      hud,
    );

    const cameraInfo = wrapInMessageEvent<CameraCalibration>(
      "calibration",
      "foxglove.CameraCalibration",
      0n,
    );
    messageHandler.handleCameraInfo(cameraInfo);
    const image = wrapInMessageEvent<RawImage>("image1", "foxglove.RawImage", 0n);
    messageHandler.handleRawImage(image);
    messageHandler.getRenderStateAndUpdateHUD();

    const hudItems = _.sortBy(hud.getHUDItems(), "id");
    expect(hudItems).toEqual([]);
  });

  it("displays no info after receiving image when calibration topic is undefined", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      { synchronize: false, calibrationTopic: undefined },
      hud,
    );

    const image = wrapInMessageEvent<RawImage>("image1", "foxglove.RawImage", 0n);
    messageHandler.handleRawImage(image);
    messageHandler.getRenderStateAndUpdateHUD();

    const hudItems = _.sortBy(hud.getHUDItems(), "id");
    expect(hudItems).toEqual([]);
  });
  it("displays no info after receiving image when synchronized is true", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler({ synchronize: true }, hud);

    const image = wrapInMessageEvent<RawImage>("image", "foxglove.RawImage", 0n);
    messageHandler.handleRawImage(image);
    messageHandler.getRenderStateAndUpdateHUD();

    const hudItems = _.sortBy(hud.getHUDItems(), "id");
    expect(hudItems).toEqual([]);
  });

  it("displays waiting for image after receiving annotations when synced", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      {
        synchronize: true,
        annotations: { annotations: { visible: true } },
      },
      hud,
    );

    const annotation = createCircleAnnotations([0n]);
    const annotationMessage = wrapInMessageEvent(
      "annotations",
      "foxglove.ImageAnnotations",
      0n,
      annotation,
    );
    messageHandler.handleAnnotations(annotationMessage as MessageEvent<ImageAnnotations>);

    messageHandler.getRenderStateAndUpdateHUD();

    const hudItems = _.sortBy(hud.getHUDItems(), "id");
    expect(hudItems).toEqual([WAITING_FOR_IMAGE_EMPTY_HUD_ITEM]);
  });

  it("displays no info after receiving synced annotations and image", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      {
        synchronize: true,
        annotations: { annotations: { visible: true } },
      },
      hud,
    );
    const time = 2n;

    const image = wrapInMessageEvent<RawImage>("image", "foxglove.RawImage", 0n, {
      timestamp: fromNanoSec(time),
    });

    const annotation = createCircleAnnotations([time]);
    const annotationMessage = wrapInMessageEvent(
      "annotations",
      "foxglove.ImageAnnotations",
      0n,
      annotation,
    );

    messageHandler.handleRawImage(image);
    messageHandler.handleAnnotations(annotationMessage as MessageEvent<ImageAnnotations>);
    messageHandler.getRenderStateAndUpdateHUD();

    const hudItems = _.sortBy(hud.getHUDItems(), "id");
    expect(hudItems).toEqual([]);
  });

  it("displays waiting for sync empty state (calibration=None) after receiving image and annotations with mismatched timestamps", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      {
        synchronize: true,
        annotations: {
          annotations1: { visible: true },
          annotations2: { visible: true },
        },
      },
      hud,
    );
    const time = 2n;

    const image = wrapInMessageEvent<RawImage>("image", "foxglove.RawImage", 0n, {
      timestamp: fromNanoSec(time),
    });

    const annotation1 = createCircleAnnotations([time]);
    const annotationMessage1 = wrapInMessageEvent(
      "annotations1",
      "foxglove.ImageAnnotations",
      0n,
      annotation1,
    );
    const annotation2 = createCircleAnnotations([time + 1n]);
    const annotationMessage2 = wrapInMessageEvent(
      "annotations2",
      "foxglove.ImageAnnotations",
      0n,
      annotation2,
    );

    messageHandler.handleRawImage(image);
    messageHandler.handleAnnotations(annotationMessage1 as MessageEvent<ImageAnnotations>);
    messageHandler.handleAnnotations(annotationMessage2 as MessageEvent<ImageAnnotations>);
    messageHandler.getRenderStateAndUpdateHUD();

    const hudItems = _.sortBy(hud.getHUDItems(), "id");
    expect(hudItems).toEqual([WAITING_FOR_SYNC_EMPTY_HUD_ITEM]);
  });

  it("displays waiting for sync empty state (calibrationTopic exists) after receiving image and annotations with mismatched timestamps", () => {
    const hud = new HUDItemManager(() => {});
    const messageHandler = new MessageHandler(
      {
        synchronize: true,
        annotations: {
          annotations1: { visible: true },
          annotations2: { visible: true },
        },
        calibrationTopic: "calibration",
      },
      hud,
    );
    const time = 2n;

    const image = wrapInMessageEvent<RawImage>("image", "foxglove.RawImage", 0n, {
      timestamp: fromNanoSec(time),
    });

    const annotation1 = createCircleAnnotations([time]);
    const annotationMessage1 = wrapInMessageEvent(
      "annotations1",
      "foxglove.ImageAnnotations",
      0n,
      annotation1,
    );
    const annotation2 = createCircleAnnotations([time + 1n]);
    const annotationMessage2 = wrapInMessageEvent(
      "annotations2",
      "foxglove.ImageAnnotations",
      0n,
      annotation2,
    );

    const cameraInfo = wrapInMessageEvent<CameraCalibration>(
      "calibration",
      "foxglove.CameraCalibration",
      0n,
    );
    messageHandler.handleCameraInfo(cameraInfo);
    messageHandler.handleRawImage(image);
    messageHandler.handleAnnotations(annotationMessage1 as MessageEvent<ImageAnnotations>);
    messageHandler.handleAnnotations(annotationMessage2 as MessageEvent<ImageAnnotations>);
    messageHandler.getRenderStateAndUpdateHUD();

    const hudItems = _.sortBy(hud.getHUDItems(), "id");
    expect(hudItems).toEqual([WAITING_FOR_SYNC_NOTICE_HUD_ITEM]);
  });

  it("displays no info after going from unsynced to synced and back", () => {
    const hud = new HUDItemManager(() => {});
    const initConfig = { synchronize: false, calibrationTopic: "calibration" };
    const messageHandler = new MessageHandler(initConfig, hud);

    const cameraInfo = wrapInMessageEvent<CameraCalibration>(
      "calibration",
      "foxglove.CameraCalibration",
      0n,
    );
    messageHandler.handleCameraInfo(cameraInfo);
    const image = wrapInMessageEvent<RawImage>("image1", "foxglove.RawImage", 0n);
    messageHandler.handleRawImage(image);

    messageHandler.setConfig({ ...initConfig, synchronize: true, calibrationTopic: "calibration" });
    messageHandler.setConfig({
      ...initConfig,
      synchronize: false,
      calibrationTopic: "calibration",
    });

    messageHandler.getRenderStateAndUpdateHUD();

    const hudItems = _.sortBy(hud.getHUDItems(), "id");
    expect(hudItems).toEqual([]);
  });
});
function createCircleAnnotations(atTimes: bigint[]): ImageAnnotations {
  return {
    circles: atTimes.map((time) => ({
      timestamp: fromNanoSec(time),
      position: { x: 20, y: 5 },
      diameter: 4,
      thickness: 1,
      fill_color: { r: 1, g: 0, b: 1, a: 1 },
      outline_color: { r: 1, g: 1, b: 0, a: 1 },
    })) as CircleAnnotation[],
    points: [] as PointsAnnotation[],
    texts: [] as TextAnnotation[],
  };
}
