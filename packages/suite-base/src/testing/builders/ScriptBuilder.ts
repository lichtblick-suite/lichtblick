// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { Script } from "@lichtblick/suite-base/panels/UserScriptEditor/script";
import { BasicBuilder, defaults } from "@lichtblick/test-builders";

class ScriptBuilder {
  public static script(props: Partial<Script> = {}): Script {
    return defaults<Script>(props, {
      filePath: BasicBuilder.string(),
      code: BasicBuilder.string(),
      readOnly: BasicBuilder.boolean(),
      selection: undefined,
    });
  }
}

export default ScriptBuilder;
