// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import MessageDefinitionBuilder from "@lichtblick/suite-base/testing/builders/MessageDefinitionBuilder";
import { OptionalMessageDefinition } from "@lichtblick/suite-base/types/RosDatatypes";
import { BasicBuilder, defaults } from "@lichtblick/test-builders";

export default class RosDatatypesBuilder {
  public static optionalMessageDefinition(
    props: Partial<OptionalMessageDefinition> = {},
  ): OptionalMessageDefinition {
    return defaults<OptionalMessageDefinition>(props, {
      definitions: MessageDefinitionBuilder.messageDefinitionFields(),
      name: BasicBuilder.string(),
    });
  }
}
