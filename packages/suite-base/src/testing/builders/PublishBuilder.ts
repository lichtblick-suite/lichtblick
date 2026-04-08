// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { PublishConfig } from "@lichtblick/suite-base/panels/Publish/types";
import { BasicBuilder, defaults } from "@lichtblick/test-builders";

export default class PublishBuilder {
  public static config(props: Partial<PublishConfig> = {}): PublishConfig {
    return defaults<PublishConfig>(props, {
      topicName: `/${BasicBuilder.string()}`,
      datatype: BasicBuilder.string(),
      buttonText: BasicBuilder.string(),
      buttonTooltip: BasicBuilder.string(),
      buttonColor: "#ffffff",
      advancedView: true,
      value: "{}",
    });
  }
}
