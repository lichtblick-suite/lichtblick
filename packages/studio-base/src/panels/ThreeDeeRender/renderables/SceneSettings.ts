// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { set } from "lodash";

import { SettingsTreeAction } from "@foxglove/studio";

import { DEFAULT_MESH_UP_AXIS } from "../ModelCache";
import { Renderer } from "../Renderer";
import { SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry } from "../SettingsManager";

export const DEFAULT_LABEL_SCALE_FACTOR = 1;

export class SceneSettings extends SceneExtension {
  public constructor(renderer: Renderer) {
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

    return [
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
            ignoreColladaUpAxis: {
              label: "Ignore COLLADA <up_axis>",
              help: "Match the behavior of rviz by ignoring the <up_axis> tag in COLLADA files",
              input: "boolean",
              value: config.scene.ignoreColladaUpAxis,
              error:
                (config.scene.ignoreColladaUpAxis ?? false) !==
                this.renderer.modelCache.options.ignoreColladaUpAxis
                  ? "This setting requires a restart to take effect"
                  : undefined,
            },
            meshUpAxis: {
              label: "Mesh up axis",
              help: "The direction to use as “up” when loading meshes without orientation info (STL and OBJ)",
              input: "select",
              value: config.scene.meshUpAxis ?? DEFAULT_MESH_UP_AXIS,
              options: [
                { label: "Y-up", value: "y_up" },
                { label: "Z-up", value: "z_up" },
              ],
              error:
                (config.scene.meshUpAxis ?? DEFAULT_MESH_UP_AXIS) !==
                this.renderer.modelCache.options.meshUpAxis
                  ? "This setting requires a restart to take effect"
                  : undefined,
            },
          },
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
