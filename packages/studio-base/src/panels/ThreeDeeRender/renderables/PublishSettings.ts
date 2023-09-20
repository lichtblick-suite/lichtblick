// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { t } from "i18next";
import * as _ from "lodash-es";

import { SettingsTreeAction } from "@foxglove/studio";

import { PublishClickType } from "./PublishClickTool";
import type { IRenderer, RendererConfig } from "../IRenderer";
import { SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";

export const DEFAULT_PUBLISH_SETTINGS: RendererConfig["publish"] = {
  type: "point",
  poseTopic: "/move_base_simple/goal",
  pointTopic: "/clicked_point",
  poseEstimateTopic: "/initialpose",
  poseEstimateXDeviation: 0.5,
  poseEstimateYDeviation: 0.5,
  poseEstimateThetaDeviation: _.round(Math.PI / 12, 8),
};

export class PublishSettings extends SceneExtension {
  public static extensionId = "foxglove.PublishSettings";
  public constructor(renderer: IRenderer, name: string = PublishSettings.extensionId) {
    super(name, renderer);

    renderer.publishClickTool.addEventListener(
      "foxglove.publish-type-change",
      this.#handlePublishToolChange,
    );
  }

  public override dispose(): void {
    this.renderer.publishClickTool.removeEventListener(
      "foxglove.publish-type-change",
      this.#handlePublishToolChange,
    );
    super.dispose();
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const config = this.renderer.config;
    const { publish } = config;
    const handler = this.handleSettingsAction;

    return [
      {
        path: ["publish"],
        node: {
          label: t("threeDee:publish"),
          fields: {
            type: {
              label: t("threeDee:type"),
              input: "select",
              value: publish.type,
              options: [
                { label: t("threeDee:publishTypePoint"), value: "point" },
                { label: t("threeDee:publishTypePose"), value: "pose" },
                {
                  label: t("threeDee:publishTypePoseEstimate"),
                  value: "pose_estimate",
                },
              ],
              help: t("threeDee:publishTypeHelp"),
            },
            topic: {
              label: t("threeDee:topic"),
              input: "string",
              value: {
                point: publish.pointTopic,
                pose: publish.poseTopic,
                pose_estimate: publish.poseEstimateTopic,
              }[publish.type],
              help: t("threeDee:publishTopicHelp"),
            },
            ...(publish.type === "pose_estimate" && {
              poseEstimateXDeviation: {
                label: t("threeDee:xDeviation"),
                input: "number",
                value: publish.poseEstimateXDeviation,
                help: t("threeDee:xDeviationHelp"),
              },
              poseEstimateYDeviation: {
                label: t("threeDee:yDeviation"),
                input: "number",
                value: publish.poseEstimateYDeviation,
                help: t("threeDee:yDeviationHelp"),
              },
              poseEstimateThetaDeviation: {
                label: t("threeDee:thetaDeviation"),
                input: "number",
                value: publish.poseEstimateThetaDeviation,
                help: t("threeDee:thetaDeviationHelp"),
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
    if (action.action !== "update" || action.payload.path.length === 0) {
      return;
    }

    const path = action.payload.path;
    const category = path[0]!;
    const value = action.payload.value;
    if (category === "publish") {
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
        this.renderer.updateConfig((draft) => _.set(draft, path, value));
      }
    } else {
      return;
    }

    // Update the settings sidebar
    this.updateSettingsTree();
  };

  #handlePublishToolChange = (): void => {
    this.renderer.updateConfig((draft) => {
      draft.publish.type = this.renderer.publishClickTool.publishClickType;
      return draft;
    });
    this.updateSettingsTree();
  };
}
