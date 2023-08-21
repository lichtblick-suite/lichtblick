// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Picks fields from the given record and returns a new record containing only those fields.
 *
 * Use this instead of lodash pick because the lodash version supports nested paths like:
 *
 * pick(r, ["a.b.c"]).
 *
 * @param record the record to transform
 * @param fields an array of fields to select from the record
 * @returns a new record containing only the selected fields
 */
export function pickFields(
  record: Readonly<Record<string, unknown>>,
  fields: readonly string[],
): Record<string, unknown> {
  if (fields.length === 0) {
    return {};
  }

  const result: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in record) {
      result[field] = record[field];
    }
  }

  return result;
}
