// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { RenderState, Topic } from "@lichtblick/suite";
import { BasicBuilder, defaults } from "@lichtblick/test-builders";

class RenderStateBuilder {
  public static renderState(props: Partial<RenderState> = {}): RenderState {
    return defaults<RenderState>(props, {});
  }

  public static topic(props: Partial<Topic> = {}): Topic {
    return defaults<Topic>(props, {
      name: BasicBuilder.string(),
      schemaName: BasicBuilder.string(),
    });
  }
}
export default RenderStateBuilder;
