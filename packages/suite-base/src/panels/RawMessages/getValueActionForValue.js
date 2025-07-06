// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { isTypicalFilterName } from "@lichtblick/suite-base/components/MessagePathSyntax/isTypicalFilterName";
const isObjectElement = (value, pathItem, structureItem) => {
    return (typeof pathItem === "string" &&
        (structureItem == undefined || structureItem.structureType === "message") &&
        typeof value === "object");
};
const isArrayElement = (value, pathItem, structureItem) => typeof pathItem === "number" &&
    (structureItem == undefined || structureItem.structureType === "array") &&
    Array.isArray(value);
// Given a root value (e.g. a message object), a root structureItem (e.g. a message definition),
// and a key path to navigate down the value and strutureItem (e.g. ["items", 10, "speed"]), return
// a bunch of paths for that navigated down value.
export function getValueActionForValue(rootValue, rootStructureItem, keyPath) {
    let singleSlicePath = "";
    let multiSlicePath = "";
    let filterPath = "";
    let value = rootValue;
    let structureItem = rootStructureItem;
    // Walk down the keyPath, while updating `value` and `structureItem`
    for (const pathItem of keyPath) {
        if (value == undefined) {
            break;
        }
        else if (isObjectElement(value, pathItem, structureItem)) {
            structureItem =
                structureItem?.structureType === "message" && typeof pathItem === "string"
                    ? structureItem.nextByName[pathItem]
                    : undefined;
            value = value[pathItem];
            if (multiSlicePath.endsWith("[:]") && structureItem?.structureType === "primitive") {
                // We're just inside a message that is inside an array, so we might want to pivot on this new value.
                if (typeof value === "bigint") {
                    filterPath = `${multiSlicePath}{${pathItem}==${value.toString()}}`;
                }
                else {
                    filterPath = `${multiSlicePath}{${pathItem}==${JSON.stringify(value) ?? ""}}`;
                }
            }
            else {
                filterPath = "";
            }
            singleSlicePath += `.${pathItem}`;
            multiSlicePath += `.${pathItem}`;
        }
        else if (isArrayElement(value, pathItem, structureItem)) {
            value = value[pathItem];
            structureItem = structureItem?.structureType === "array" ? structureItem.next : undefined;
            multiSlicePath = `${singleSlicePath}[:]`;
            // Ideally show something like `/topic.object[:]{id=123}` for the singleSlicePath, but fall
            // back to `/topic.object[10]` if necessary.
            let typicalFilterName;
            if (structureItem?.structureType === "message") {
                typicalFilterName = Object.entries(structureItem.nextByName).find(([key, nextStructureItem]) => nextStructureItem.structureType === "primitive" && isTypicalFilterName(key))?.[0];
            }
            if (typeof value === "object" &&
                value != undefined &&
                typeof typicalFilterName === "string") {
                const filterValue = value[typicalFilterName];
                singleSlicePath += `[:]{${typicalFilterName}==${typeof filterValue === "bigint"
                    ? filterValue.toString()
                    : JSON.stringify(filterValue) ?? ""}}`;
            }
            else {
                singleSlicePath += `[${pathItem}]`;
            }
        }
        else if (structureItem?.structureType === "primitive") {
            // ROS has primitives with nested data (time, duration).
            // We currently don't support looking inside them.
            return undefined;
        }
        else {
            throw new Error(`Invalid structureType: ${structureItem?.structureType} for value/pathItem.`);
        }
    }
    // At this point we should be looking at a primitive. If not, just return nothing.
    if (value != undefined) {
        // If we know the primitive type from the schema, use it.
        if (structureItem?.structureType === "primitive") {
            return {
                singleSlicePath,
                multiSlicePath,
                primitiveType: structureItem.primitiveType,
                filterPath,
            };
        }
        // Otherwise, deduce a roughly-correct type from the runtime type of the value.
        let primitiveType;
        switch (typeof value) {
            case "bigint":
                primitiveType = "int64";
                break;
            case "boolean":
                primitiveType = "bool";
                break;
            case "number":
                primitiveType = "int32"; // compatible with both Plot and State Transitions
                break;
            case "string":
                primitiveType = "string";
                break;
            default:
                break;
        }
        if (primitiveType != undefined) {
            return {
                singleSlicePath,
                multiSlicePath,
                primitiveType,
                filterPath,
            };
        }
    }
    return undefined;
}
// Given root structureItem (e.g. a message definition),
// and a key path to navigate down, return strutureItem for the field at that path
export const getStructureItemForPath = (rootStructureItem, keyPath) => {
    let structureItem = rootStructureItem;
    // Walk down the keyPath, while updating `value` and `structureItem`
    for (const pathItem of keyPath) {
        if (structureItem == undefined) {
            break;
        }
        else if (structureItem.structureType === "message" && typeof pathItem === "string") {
            structureItem = structureItem.nextByName[pathItem];
        }
        else if (structureItem.structureType === "array" && typeof pathItem === "number") {
            structureItem = structureItem.next;
        }
        else if (structureItem.structureType === "primitive") {
            // ROS has some primitives that contain nested data (time+duration). We currently don't
            // support looking inside them.
            return structureItem;
        }
        else {
            throw new Error(`Invalid structureType: ${structureItem.structureType} for value/pathItem.`);
        }
    }
    return structureItem;
};
