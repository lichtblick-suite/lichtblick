// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
const packValue = (value, map) => {
    if (value == undefined) {
        return value;
    }
    if (Array.isArray(value)) {
        return value.map((element) => packValue(element, map));
    }
    if (value instanceof Map) {
        const transformed = new Map();
        for (const [key, otherValue] of value.entries()) {
            const newKey = packValue(key, map);
            if (typeof newKey !== "string") {
                continue;
            }
            transformed.set(newKey, packValue(otherValue, map));
        }
        return transformed;
    }
    if (value instanceof Set || ArrayBuffer.isView(value)) {
        // we do not dedupe in sets or TypedArrays for now
        return value;
    }
    switch (typeof value) {
        case "object": {
            const transformed = {};
            for (const [key, otherValue] of Object.entries(value)) {
                const newKey = packValue(key, map);
                if (typeof newKey !== "string") {
                    continue;
                }
                transformed[newKey] = packValue(otherValue, map);
            }
            return transformed;
        }
        case "string":
            if (!(value in map)) {
                map[value] = value;
            }
            // point all instances of the same string to the same reference
            return map[value];
        default:
            return value;
    }
};
/**
 * Deduplicate all string references in the given data structure. This is
 * useful to do after `postMessage()`, since `structuredClone()` duplicates
 * strings.
 *
 * See: https://bugs.chromium.org/p/chromium/issues/detail?id=1487682&q=&can=4
 */
export default function strPack(data) {
    const map = {};
    return packValue(data, map);
}
