// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { cloneDeep, round, set } from "lodash";

import { SettingsTreeAction } from "@foxglove/studio";

import { FollowMode, Renderer, RendererConfig } from "../Renderer";
import { SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { DEFAULT_CAMERA_STATE } from "../camera";
import { PRECISION_DEGREES, PRECISION_DISTANCE, SelectEntry } from "../settings";
import { CoordinateFrame } from "../transforms";
import { PublishClickType } from "./PublishClickTool";

export const DEFAULT_LABEL_SCALE_FACTOR = 1;
export const DEFAULT_AXIS_SCALE = 1;
export const DEFAULT_LINE_WIDTH_PX = 2;
export const DEFAULT_LINE_COLOR_STR = "#ffff00";
export const DEFAULT_TF_LABEL_SIZE = 0.2;

export const DEFAULT_PUBLISH_SETTINGS: RendererConfig["publish"] = {
  type: "point",
  poseTopic: "/move_base_simple/goal",
  pointTopic: "/clicked_point",
  poseEstimateTopic: "/initialpose",
  poseEstimateXDeviation: 0.5,
  poseEstimateYDeviation: 0.5,
  poseEstimateThetaDeviation: round(Math.PI / 12, 8),
};

export class CoreSettings extends SceneExtension {
  public constructor(renderer: Renderer) {
    super("foxglove.CoreSettings", renderer);

    renderer.on("transformTreeUpdated", this.handleTransformTreeUpdated);
    renderer.on("cameraMove", this.handleCameraMove);
    renderer.publishClickTool.addEventListener(
      "foxglove.publish-type-change",
      this.handlePublishToolChange,
    );

    renderer.labelPool.scaleFactor =
      renderer.config.scene.labelScaleFactor ?? DEFAULT_LABEL_SCALE_FACTOR;
  }

  public override dispose(): void {
    this.renderer.off("transformTreeUpdated", this.handleTransformTreeUpdated);
    this.renderer.off("cameraMove", this.handleCameraMove);
    this.renderer.publishClickTool.removeEventListener(
      "foxglove.publish-type-change",
      this.handlePublishToolChange,
    );
    super.dispose();
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const config = this.renderer.config;
    const { cameraState: camera, publish } = config;
    const handler = this.handleSettingsAction;

    // If the user-selected frame does not exist, show it in the dropdown
    // anyways. A settings node error will be displayed
    let followTfOptions = this.renderer.coordinateFrameList;
    const followFrameId = this.renderer.followFrameId;
    if (followFrameId != undefined && !this.renderer.transformTree.hasFrame(followFrameId)) {
      followTfOptions = [
        { label: CoordinateFrame.DisplayName(followFrameId), value: followFrameId },
        ...followTfOptions,
      ];
    }

    const followTfValue = selectBest(
      [this.renderer.followFrameId, config.followTf, this.renderer.renderFrameId],
      followTfOptions,
    );
    const followTfError = this.renderer.settings.errors.errors.errorAtPath(["general", "followTf"]);

    const followModeOptions = [
      { label: "Pose", value: "follow-pose" },
      { label: "Position", value: "follow-position" },
      { label: "Fixed", value: "follow-none" },
    ];
    const followModeValue = this.renderer.followMode;

    return [
      {
        path: ["general"],
        node: {
          label: "Frame",
          fields: {
            followTf: {
              label: "Display frame",
              help: "The coordinate frame to place the camera in. The camera position and orientation will be relative to the origin of this frame.",
              input: "select",
              options: followTfOptions,
              value: followTfValue,
              error: followTfError,
            },
            followMode: {
              label: "Follow mode",
              help: "Change the camera behavior during playback to follow the display frame or not.",
              input: "select",
              options: followModeOptions,
              value: followModeValue,
            },
          },
          defaultExpansionState: "expanded",
          handler,
        },
      },
      {
        path: ["scene"],
        node: {
          label: "Scene",
          actions: [{ type: "action", id: "reset-scene", label: "Reset" }],
          fields: {
            enableStats: {
              label: "Render stats",
              input: "boolean",
              value: config.scene.enableStats,
            },
            backgroundColor: {
              label: "Background",
              input: "rgb",
              value: config.scene.backgroundColor,
            },
            labelScaleFactor: {
              label: "Label scale",
              help: "Scale factor to apply to all labels",
              input: "number",
              min: 0,
              step: 0.1,
              precision: 2,
              value: config.scene.labelScaleFactor,
              placeholder: String(DEFAULT_LABEL_SCALE_FACTOR),
            },
          },
          children: {
            cameraState: {
              label: "View",
              actions: [{ type: "action", id: "reset-camera", label: "Reset" }],
              fields: {
                distance: {
                  label: "Distance",
                  input: "number",
                  step: 1,
                  precision: PRECISION_DISTANCE,
                  value: camera.distance,
                },
                perspective: { label: "Perspective", input: "boolean", value: camera.perspective },
                targetOffset: {
                  label: "Target",
                  input: "vec3",
                  labels: ["X", "Y", "Z"],
                  precision: PRECISION_DISTANCE,
                  value: [...camera.targetOffset],
                },
                thetaOffset: {
                  label: "Theta",
                  input: "number",
                  step: 1,
                  precision: PRECISION_DEGREES,
                  value: camera.thetaOffset,
                },
                ...(camera.perspective && {
                  phi: {
                    label: "Phi",
                    input: "number",
                    step: 1,
                    precision: PRECISION_DEGREES,
                    value: camera.phi,
                  },
                  fovy: {
                    label: "Y-Axis FOV",
                    input: "number",
                    step: 1,
                    precision: PRECISION_DEGREES,
                    value: camera.fovy,
                  },
                }),
                near: {
                  label: "Near",
                  input: "number",
                  step: DEFAULT_CAMERA_STATE.near,
                  precision: PRECISION_DISTANCE,
                  value: camera.near,
                },
                far: {
                  label: "Far",
                  input: "number",
                  step: 1,
                  precision: PRECISION_DISTANCE,
                  value: camera.far,
                },
              },
            },
          },
          defaultExpansionState: "collapsed",
          handler,
        },
      },
      {
        path: ["publish"],
        node: {
          label: "Publish",
          fields: {
            type: {
              label: "Type",
              input: "select",
              value: publish.type,
              options: [
                { label: "Point (geometry_msgs/Point)", value: "point" },
                { label: "Pose (geometry_msgs/PoseStamped)", value: "pose" },
                {
                  label: "Pose estimate (geometry_msgs/PoseWithCovarianceStamped)",
                  value: "pose_estimate",
                },
              ],
              help: "The type of message to publish when clicking in the scene",
            },
            topic: {
              label: "Topic",
              input: "string",
              value: {
                point: publish.pointTopic,
                pose: publish.poseTopic,
                pose_estimate: publish.poseEstimateTopic,
              }[publish.type],
              help: `The topic on which to publish ${
                { point: "points", pose: "poses", pose_estimate: "pose estimates" }[publish.type]
              }`,
            },
            ...(publish.type === "pose_estimate" && {
              poseEstimateXDeviation: {
                label: "X deviation",
                input: "number",
                value: publish.poseEstimateXDeviation,
                help: "The X standard deviation to publish with pose estimates",
              },
              poseEstimateYDeviation: {
                label: "Y deviation",
                input: "number",
                value: publish.poseEstimateYDeviation,
                help: "The Y standard deviation to publish with pose estimates",
              },
              poseEstimateThetaDeviation: {
                label: "Theta deviation",
                input: "number",
                value: publish.poseEstimateThetaDeviation,
                help: "The theta standard deviation to publish with pose estimates",
              },
            }),
          },
          defaultExpansionState: "collapsed",
          handler,
        },
      },
    ];
  }

  public override handleSettingsAction = (action: SettingsTreeAction): void => {
    if (action.action === "perform-node-action" && action.payload.id === "reset-camera") {
      this.renderer.updateConfig((draft) => {
        draft.cameraState = cloneDeep(DEFAULT_CAMERA_STATE);
      });
      this.updateSettingsTree();
      return;
    }

    if (action.action === "perform-node-action" && action.payload.id === "reset-scene") {
      this.renderer.updateConfig((draft) => {
        draft.scene = {};
      });
      this.updateSettingsTree();
      return;
    }

    if (action.action !== "update" || action.payload.path.length === 0) {
      return;
    }

    const path = action.payload.path;
    const category = path[0]!;
    const value = action.payload.value;
    if (category === "general") {
      if (path[1] === "followTf") {
        const followTf = value as string | undefined;
        // Update the configuration. This is done manually since followTf is at the top level of
        // config, not under `general`
        this.renderer.updateConfig((draft) => {
          draft.followTf = followTf;
        });

        this.renderer.followFrameId = followTf;
        this.renderer.settings.errors.clearPath(["general", "followTf"]);
      } else if (path[1] === "followMode") {
        const followMode = value as FollowMode;
        // Update the configuration. This is done manually since followMode is at the top level of
        // config, not under `general`
        this.renderer.updateConfig((draft) => {
          // any follow -> stationary no clear
          // stationary -> any follow clear offset (center on frame)
          if (draft.followMode === "follow-none") {
            draft.cameraState.targetOffset = [...DEFAULT_CAMERA_STATE.targetOffset];
            draft.cameraState.thetaOffset = DEFAULT_CAMERA_STATE.thetaOffset;
          } else if (followMode === "follow-pose") {
            draft.cameraState.thetaOffset = DEFAULT_CAMERA_STATE.thetaOffset;
          }
          draft.followMode = followMode;
        });

        this.renderer.updateFollowMode(followMode);
      }
    } else if (category === "scene") {
      if (path[1] === "cameraState") {
        // Update the configuration. This is done manually since cameraState is at the top level of
        // config, not under `scene`
        this.renderer.updateConfig((draft) => set(draft, path.slice(1), value));
      } else {
        // Update the configuration
        this.renderer.updateConfig((draft) => set(draft, path, value));

        if (path[1] === "backgroundColor") {
          const backgroundColor = value as string | undefined;
          this.renderer.setColorScheme(this.renderer.colorScheme, backgroundColor);
        } else if (path[1] === "labelScaleFactor") {
          const labelScaleFactor = value as number | undefined;
          this.renderer.labelPool.setScaleFactor(labelScaleFactor ?? DEFAULT_LABEL_SCALE_FACTOR);
        }
      }
    } else if (category === "publish") {
      // Update the configuration
      if (path[1] === "topic") {
        this.renderer.updateConfig((draft) => {
          switch (draft.publish.type) {
            case "point":
              draft.publish.pointTopic =
                (value as string | undefined) ?? DEFAULT_PUBLISH_SETTINGS.pointTopic;
              break;
            case "pose":
              draft.publish.poseTopic =
                (value as string | undefined) ?? DEFAULT_PUBLISH_SETTINGS.poseTopic;
              break;
            case "pose_estimate":
              draft.publish.poseEstimateTopic =
                (value as string | undefined) ?? DEFAULT_PUBLISH_SETTINGS.poseEstimateTopic;
              break;
          }
        });
      } else if (path[1] === "type") {
        // ThreeDeeRender will update the config based on this change
        if (this.renderer.publishClickTool.publishClickType !== value) {
          this.renderer.publishClickTool.setPublishClickType(value as PublishClickType);
          this.renderer.publishClickTool.stop();
        }
      } else {
        this.renderer.updateConfig((draft) => set(draft, path, value));
      }
    } else {
      return;
    }

    // Update the settings sidebar
    this.updateSettingsTree();
  };

  private handleTransformTreeUpdated = (): void => {
    this.updateSettingsTree();
  };

  private handleCameraMove = (): void => {
    this.updateSettingsTree();
  };

  private handlePublishToolChange = (): void => {
    this.renderer.updateConfig((draft) => {
      draft.publish.type = this.renderer.publishClickTool.publishClickType;
      return draft;
    });
    this.updateSettingsTree();
  };
}

function selectBest(
  choices: ReadonlyArray<string | undefined>,
  validEntries: ReadonlyArray<SelectEntry>,
): string | undefined {
  const validChoices = choices.filter((choice) =>
    validEntries.some((entry) => entry.value === choice),
  );
  return validChoices[0];
}
