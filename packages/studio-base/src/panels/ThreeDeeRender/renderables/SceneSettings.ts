// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { t } from "i18next";
import { set } from "lodash";

import { SettingsTreeAction, SettingsTreeFields } from "@foxglove/studio";

import type { IRenderer } from "../IRenderer";
import { DEFAULT_MESH_UP_AXIS } from "../ModelCache";
import { SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";

export const DEFAULT_LABEL_SCALE_FACTOR = 1;

export class SceneSettings extends SceneExtension {
  public constructor(renderer: IRenderer) {
    super("foxglove.SceneSettings", renderer);

    renderer.labelPool.scaleFactor =
      renderer.config.scene.labelScaleFactor ?? DEFAULT_LABEL_SCALE_FACTOR;
  }

  public override dispose(): void {
    super.dispose();
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const config = this.renderer.config;
    const handler = this.handleSettingsAction;

    const fields: SettingsTreeFields = {
      enableStats: {
        label: t("threeDee:renderStats"),
        input: "boolean",
        value: config.scene.enableStats,
      },
      debugPicking: {
        label: t("threeDee:debugPicking"),
        input: "boolean",
        value: this.renderer.debugPicking,
      },
      backgroundColor: {
        label: t("threeDee:background"),
        input: "rgb",
        value: config.scene.backgroundColor,
      },
      labelScaleFactor: {
        label: t("threeDee:labelScale"),
        help: t("threeDee:labelScaleHelp"),
        input: "number",
        min: 0,
        step: 0.1,
        precision: 2,
        value: config.scene.labelScaleFactor,
        placeholder: String(DEFAULT_LABEL_SCALE_FACTOR),
      },
      ignoreColladaUpAxis: {
        label: t("threeDee:ignoreColladaUpAxis"),
        help: t("threeDee:ignoreColladaUpAxisHelp"),
        input: "boolean",
        value: config.scene.ignoreColladaUpAxis,
        error:
          (config.scene.ignoreColladaUpAxis ?? false) !==
          this.renderer.modelCache.options.ignoreColladaUpAxis
            ? t("threeDee:takeEffectAfterReboot")
            : undefined,
      },
      meshUpAxis: {
        label: t("threeDee:meshUpAxis"),
        help: t("threeDee:meshUpAxisHelp"),
        input: "select",
        value: config.scene.meshUpAxis ?? DEFAULT_MESH_UP_AXIS,
        options: [
          { label: t("threeDee:YUp"), value: "y_up" },
          { label: t("threeDee:ZUp"), value: "z_up" },
        ],
        error:
          (config.scene.meshUpAxis ?? DEFAULT_MESH_UP_AXIS) !==
          this.renderer.modelCache.options.meshUpAxis
            ? t("threeDee:takeEffectAfterReboot")
            : undefined,
      },
    };

    if (process.env.NODE_ENV === "production") {
      delete fields.debugPicking;
    }
    return [
      {
        path: ["scene"],
        node: {
          label: t("threeDee:scene"),
          actions: [{ type: "action", id: "reset-scene", label: t("threeDee:reset") }],
          fields,
          defaultExpansionState: "collapsed",
          handler,
        },
      },
    ];
  }

  public override handleSettingsAction = (action: SettingsTreeAction): void => {
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
    if (category === "scene") {
      if (path[1] === "debugPicking") {
        this.renderer.debugPicking = (value as boolean | undefined) ?? false;
        this.updateSettingsTree();
        return;
      }
      // Update the configuration
      this.renderer.updateConfig((draft) => set(draft, path, value));

      if (path[1] === "backgroundColor") {
        const backgroundColor = value as string | undefined;
        this.renderer.setColorScheme(this.renderer.colorScheme, backgroundColor);
      } else if (path[1] === "labelScaleFactor") {
        const labelScaleFactor = value as number | undefined;
        this.renderer.labelPool.setScaleFactor(labelScaleFactor ?? DEFAULT_LABEL_SCALE_FACTOR);
      }
    } else {
      return;
    }

    // Update the settings sidebar
    this.updateSettingsTree();
  };
}
