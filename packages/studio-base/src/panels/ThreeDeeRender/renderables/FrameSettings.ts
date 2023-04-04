// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { t } from "i18next";

import { SettingsTreeAction } from "@foxglove/studio";

import { FollowMode, Renderer } from "../Renderer";
import { SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";
import { DEFAULT_CAMERA_STATE } from "../camera";
import { SelectEntry } from "../settings";
import { CoordinateFrame } from "../transforms";

const FOLLOW_TF_PATH = ["general", "followTf"];

export class FrameSettings extends SceneExtension {
  public constructor(renderer: Renderer) {
    super("foxglove.FrameSettings", renderer);

    renderer.on("transformTreeUpdated", this.handleTransformTreeUpdated);
    renderer.settings.errors.on("update", this.handleErrorChange);
    renderer.settings.errors.on("clear", this.handleErrorChange);
    renderer.settings.errors.on("remove", this.handleErrorChange);
  }

  public override dispose(): void {
    this.renderer.off("transformTreeUpdated", this.handleTransformTreeUpdated);
    this.renderer.settings.errors.off("update", this.handleErrorChange);
    this.renderer.settings.errors.off("clear", this.handleErrorChange);
    this.renderer.settings.errors.off("remove", this.handleErrorChange);
    super.dispose();
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const config = this.renderer.config;
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
    const followTfError = this.renderer.settings.errors.errors.errorAtPath(FOLLOW_TF_PATH);

    const followModeOptions = [
      { label: t("threeDee:pose"), value: "follow-pose" },
      { label: t("threeDee:position"), value: "follow-position" },
      { label: t("threeDee:fixed"), value: "follow-none" },
    ];
    const followModeValue = this.renderer.followMode;

    return [
      {
        path: ["general"],
        node: {
          label: t("threeDee:frame"),
          fields: {
            followTf: {
              label: t("threeDee:displayFrame"),
              help: t("threeDee:displayFrameHelp"),
              input: "select",
              options: followTfOptions,
              value: followTfValue,
              error: followTfError,
            },
            followMode: {
              label: t("threeDee:followMode"),
              help: t("threeDee:followModeHelp"),
              input: "select",
              options: followModeOptions,
              value: followModeValue,
            },
          },
          defaultExpansionState: "expanded",
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
    } else {
      return;
    }

    // Update the settings sidebar
    this.updateSettingsTree();
  };

  private handleTransformTreeUpdated = (): void => {
    this.updateSettingsTree();
  };

  private handleErrorChange = (): void => {
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
