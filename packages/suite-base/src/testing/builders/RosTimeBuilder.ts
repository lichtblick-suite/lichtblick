// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Time } from "@lichtblick/rostime";
import { BasicBuilder, defaults } from "@lichtblick/test-builders";

export default class RosTimeBuilder {
  public static time(props: Partial<Time> = {}): Time {
    return defaults<Time>(props, {
      nsec: BasicBuilder.number(),
      sec: BasicBuilder.number(),
    });
  }
}
