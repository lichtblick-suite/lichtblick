// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { cloneDeep, set } from "lodash";

import { DEFAULT_CAMERA_STATE } from "@foxglove/regl-worldview";
import { SettingsTreeAction } from "@foxglove/studio";

import { Renderer } from "../Renderer";
import { SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { fieldSize, PRECISION_DEGREES, PRECISION_DISTANCE, SelectEntry } from "../settings";
import type { FrameAxes } from "./FrameAxes";

export const DEFAULT_LABEL_SCALE_FACTOR = 1;
export const DEFAULT_AXIS_SCALE = 1;
export const DEFAULT_LINE_WIDTH_PX = 2;
export const DEFAULT_LINE_COLOR_STR = "#ffff00";
export const DEFAULT_TF_LABEL_SIZE = 0.2;

const ONE_DEGREE = Math.PI / 180;

export class CoreSettings extends SceneExtension {
  constructor(renderer: Renderer) {
    super("foxglove.CoreSettings", renderer);

    renderer.on("transformTreeUpdated", this.handleTransformTreeUpdated);
    renderer.on("cameraMove", this.handleCameraMove);
  }

  override dispose(): void {
    this.renderer.off("transformTreeUpdated", this.handleTransformTreeUpdated);
    this.renderer.off("cameraMove", this.handleCameraMove);
    super.dispose();
  }

  override settingsNodes(): SettingsTreeEntry[] {
    const config = this.renderer.config;
    const camera = config.cameraState;
    const handler = this.handleSettingsAction;

    const followTfOptions = this.renderer.coordinateFrameList;
    const followTfValue = selectBest(
      [this.renderer.followFrameId, config.followTf, this.renderer.renderFrameId],
      followTfOptions,
    );

    return [
      {
        path: ["general"],
        node: {
          label: "General",
          fields: {
            followTf: {
              label: "Frame",
              input: "select",
              options: followTfOptions,
              value: followTfValue,
              error: this.renderer.settings.errors.errors.errorAtPath(["general", "followTf"]),
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
            backgroundColor: { label: "Color", input: "rgb", value: config.scene.backgroundColor },
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
            transforms: {
              label: "Transforms",
              fields: {
                showLabel: {
                  label: "Labels",
                  input: "boolean",
                  value: config.scene.transforms?.showLabel ?? true,
                },
                ...((config.scene.transforms?.showLabel ?? true) && {
                  labelSize: {
                    label: "Label size",
                    input: "number",
                    min: 0,
                    step: 0.01,
                    precision: 2,
                    placeholder: String(DEFAULT_TF_LABEL_SIZE),
                    value: config.scene.transforms?.labelSize,
                  },
                }),
                axisScale: fieldSize(
                  "Axis scale",
                  config.scene.transforms?.axisScale,
                  DEFAULT_AXIS_SCALE,
                ),
                lineWidth: {
                  label: "Line width",
                  input: "number",
                  min: 0,
                  step: 0.5,
                  precision: 1,
                  value: config.scene.transforms?.lineWidth,
                  placeholder: String(DEFAULT_LINE_WIDTH_PX),
                },
                lineColor: {
                  label: "Line color",
                  input: "rgb",
                  value: config.scene.transforms?.lineColor ?? DEFAULT_LINE_COLOR_STR,
                },
              },
            },
          },
          defaultExpansionState: "collapsed",
          handler,
        },
      },
      {
        path: ["cameraState"],
        node: {
          label: "Camera",
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
              step: ONE_DEGREE,
              precision: PRECISION_DEGREES,
              value: camera.thetaOffset,
            },
            ...(camera.perspective && {
              phi: {
                label: "Phi",
                input: "number",
                step: ONE_DEGREE,
                precision: PRECISION_DEGREES,
                value: camera.phi,
              },
              fovy: {
                label: "Y-Axis FOV",
                input: "number",
                step: ONE_DEGREE,
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
          defaultExpansionState: "collapsed",
          handler,
        },
      },
    ];
  }

  handleSettingsAction = (action: SettingsTreeAction): void => {
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
      }
    } else if (category === "scene") {
      // Update the configuration
      this.renderer.updateConfig((draft) => set(draft, path, value));

      if (path[1] === "backgroundColor") {
        const backgroundColor = value as string | undefined;
        this.renderer.setColorScheme(this.renderer.colorScheme, backgroundColor);
      } else if (path[1] === "labelScaleFactor") {
        const labelScaleFactor = value as number | undefined;
        this.renderer.labelPool.setScaleFactor(labelScaleFactor ?? DEFAULT_LABEL_SCALE_FACTOR);
      } else if (path[1] === "transforms") {
        const frameAxes = this.renderer.sceneExtensions.get("foxglove.FrameAxes") as
          | FrameAxes
          | undefined;

        if (path[2] === "showLabel") {
          const showLabel = value as boolean | undefined;
          frameAxes?.setLabelVisible(showLabel ?? true);
        } else if (path[2] === "labelSize") {
          const labelSize = value as number | undefined;
          frameAxes?.setLabelSize(labelSize ?? DEFAULT_TF_LABEL_SIZE);
        } else if (path[2] === "axisScale") {
          const axisScale = value as number | undefined;
          frameAxes?.setAxisScale(axisScale ?? DEFAULT_AXIS_SCALE);
        } else if (path[2] === "lineWidth") {
          const lineWidth = value as number | undefined;
          frameAxes?.setLineWidth(lineWidth ?? DEFAULT_LINE_WIDTH_PX);
        } else if (path[2] === "lineColor") {
          const lineColor = value as string | undefined;
          frameAxes?.setLineColor(lineColor ?? DEFAULT_LINE_COLOR_STR);
        }
      }
    } else if (category === "cameraState") {
      // Update the configuration
      this.renderer.updateConfig((draft) => set(draft, path, value));
    } else {
      return;
    }

    // Update the settings sidebar
    this.updateSettingsTree();
  };

  handleTransformTreeUpdated = (): void => {
    this.updateSettingsTree();
  };

  handleCameraMove = (): void => {
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
