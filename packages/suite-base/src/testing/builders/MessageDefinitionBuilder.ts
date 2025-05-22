// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MessageDefinition, MessageDefinitionField } from "@lichtblick/message-definition";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import { defaults } from "@lichtblick/suite-base/testing/builders/utilities";

export default class MessageDefinitionBuilder {
  public static messageDefinitionField(
    props: Partial<MessageDefinitionField> = {},
  ): MessageDefinitionField {
    return defaults<MessageDefinitionField>(props, {
      type: BasicBuilder.string(),
      name: BasicBuilder.string(),
      isComplex: BasicBuilder.boolean(),
      isArray: BasicBuilder.boolean(),
      arrayLength: BasicBuilder.number(),
      isConstant: BasicBuilder.boolean(),
      value: BasicBuilder.string(),
      defaultValue: BasicBuilder.string(),
      arrayUpperBound: BasicBuilder.number(),
      upperBound: BasicBuilder.number(),
      valueText: BasicBuilder.string(),
    });
  }

  public static messageDefinitionFields(count = 3): MessageDefinitionField[] {
    return BasicBuilder.multiple(MessageDefinitionBuilder.messageDefinitionField, count);
  }

  public static messageDefinition(props: Partial<MessageDefinition> = {}): MessageDefinition {
    return defaults<MessageDefinition>(props, {
      name: BasicBuilder.string(),
      definitions: MessageDefinitionBuilder.messageDefinitionFields(),
    });
  }
}
