// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Time } from "@lichtblick/rostime";
import { SettingsTreeAction } from "@lichtblick/suite";
import { HUD_INFO_MESSAGE_DATATYPES } from "@lichtblick/suite-base/panels/ThreeDeeRender/foxglove";
import { MessageEvent } from "@lichtblick/suite-base/players/types";

import type { AnyRendererSubscription, IRenderer } from "../IRenderer";
import { SceneExtension } from "../SceneExtension";
import { SettingsTreeEntry, SettingsTreeNodeWithActionHandler } from "../SettingsManager";
import { BaseSettings } from "../settings";
import { topicIsConvertibleToSchema } from "../topicIsConvertibleToSchema";

export type HUDInfoMessage = {
  timestamp: Time;
  texts: string[];
};

export type HUDInfoMessageSettings = BaseSettings;
const DEFAULT_SETTINGS: HUDInfoMessageSettings = {
  visible: false,
  frameLocked: true,
};

export class HUDInfoMessages extends SceneExtension {
  public static extensionId = "lichtblick.HUDInfoMessage";

  public constructor(renderer: IRenderer, name: string = HUDInfoMessages.extensionId) {
    super(name, renderer);
  }

  public override getSubscriptions(): readonly AnyRendererSubscription[] {
    return [
      {
        type: "schema",
        schemaNames: HUD_INFO_MESSAGE_DATATYPES,
        subscription: {
          handler: this.#handleHUDInfoMessage,
          shouldSubscribe: this.#shouldSubscribe,
        },
      },
    ];
  }

  public override settingsNodes(): SettingsTreeEntry[] {
    const configTopics = this.renderer.config.hudInfoTopics;
    const entries: SettingsTreeEntry[] = [];

    for (const topic of this.renderer.topics ?? []) {
      if (!topicIsConvertibleToSchema(topic, HUD_INFO_MESSAGE_DATATYPES)) {
        continue;
      }

      const config = (configTopics[topic.name] ?? {}) as Partial<HUDInfoMessageSettings>;
      const node: SettingsTreeNodeWithActionHandler = {
        label: topic.name,
        icon: "NorthWest",
        order: topic.name.toLocaleLowerCase(),
        visible: config.visible ?? DEFAULT_SETTINGS.visible,
        handler: this.handleSettingsAction,
      };
      entries.push({ path: ["hudInfoTopics", topic.name], node });
    }

    return entries;
  }

  public override handleSettingsAction = (action: SettingsTreeAction): void => {
    const path = action.payload.path;
    if (action.action !== "update" || path.length !== 3) {
      return;
    }

    this.saveSetting(path, action.payload.value);
  };

  public override saveSetting(path: readonly string[], value: unknown): void {
    super.saveSetting(path, value);

    // Handle visibility changes for HUD info topics
    if (path.length === 3 && path[0] === "hudInfoTopics" && path[2] === "visible") {
      const topicName = path[1]!;
      const isVisible = value === true;

      if (!isVisible) {
        // Clear HUD info when topic becomes invisible
        this.renderer.hudManager.clearInfoMessagesForTopic(topicName);
      }
    }
  }

  #shouldSubscribe = (topicName: string): boolean => {
    const config = this.renderer.config.hudInfoTopics[topicName];
    return config?.visible === true;
  };

  #handleHUDInfoMessage = (messageEvent: MessageEvent<HUDInfoMessage>): void => {
    const { topic, message } = messageEvent;

    if (message.texts.length === 0) {
      // Treat empty message as a removal
      this.renderer.hudManager.clearInfoMessagesForTopic(topic);
    } else {
      this.renderer.hudManager.setInfoMessagesForTopic(topic, message.texts);
    }
  };
}
