// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  DIAGNOSTIC_SEVERITY,
  SOURCES,
} from "@lichtblick/suite-base/players/UserScriptPlayer/constants";
import { Diagnostic, UserScriptLog } from "@lichtblick/suite-base/players/UserScriptPlayer/types";
import { BasicBuilder, defaults } from "@lichtblick/test-builders";

class UserScriptBuilder {
  public static diagnostic(props: Partial<Diagnostic> = {}): Diagnostic {
    return defaults<Diagnostic>(props, {
      severity: BasicBuilder.sample(DIAGNOSTIC_SEVERITY),
      message: BasicBuilder.string(),
      source: BasicBuilder.sample(SOURCES),
      startLineNumber: BasicBuilder.number(),
      startColumn: BasicBuilder.number(),
      endLineNumber: BasicBuilder.number(),
      endColumn: BasicBuilder.number(),
      code: BasicBuilder.number(),
    });
  }

  public static diagnostics(count = 3): Diagnostic[] {
    return BasicBuilder.multiple(UserScriptBuilder.diagnostic, count);
  }

  public static log(props: Partial<UserScriptLog> = {}): UserScriptLog {
    return defaults<UserScriptLog>(props, {
      source: BasicBuilder.sample(["registerScript", "processMessage"]),
      value: BasicBuilder.string(),
    });
  }

  public static logs(count = 3): UserScriptLog[] {
    return BasicBuilder.multiple(UserScriptBuilder.log, count);
  }
}

export default UserScriptBuilder;
