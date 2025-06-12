// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Topic } from "@lichtblick/suite";

/**
 * Determines whether `topic` has a supported schema from the set of `supportedSchemaNames`, either
 * as the original schema or one of the `convertibleTo` schemas.
 */
export function topicIsConvertibleToSchema(
  topic: Topic,
  supportedSchemaNames: Set<string>,
): boolean {
  return (
    supportedSchemaNames.has(topic.schemaName) ||
    (topic.convertibleTo?.some((name) => supportedSchemaNames.has(name)) ?? false)
  );
}
