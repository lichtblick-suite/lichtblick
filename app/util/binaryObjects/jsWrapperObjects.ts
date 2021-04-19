// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import memoize from "memoize-weak";
import { RosMsgField } from "rosbag";

import { RosDatatypes } from "@foxglove-studio/app/types/RosDatatypes";
import {
  PrimitiveArrayView,
  getReverseWrapperArrayView,
} from "@foxglove-studio/app/util/binaryObjects/ArrayViews";
import {
  addTimeTypes,
  associateDatatypes,
  deepParseSymbol,
  friendlyTypeName,
  isComplex,
  indent,
} from "@foxglove-studio/app/util/binaryObjects/messageDefinitionUtils";

const arrayTypeName = (typeName: string): string => `${friendlyTypeName(typeName)}$Array`;

const printFieldDefinitionBody = (field: RosMsgField): string => {
  if (field.isConstant) {
    const value = JSON.stringify(field.value);
    if (value == undefined) {
      throw new Error(`Could not serialize constant value for field ${field.name}`);
    }
    return `return ${value};`;
  }
  const complexExpression = (type: string) => `const $fieldValue = this[$value].${field.name};
if ($fieldValue == undefined || $fieldValue[$deepParse] != undefined) {
  return $fieldValue;
}
return new ${type}($fieldValue);`;
  if (field.isArray && field.type !== "int8" && field.type !== "uint8") {
    if (isComplex(field.type) || field.type === "time" || field.type === "duration") {
      return complexExpression(arrayTypeName(field.type));
    }
    return complexExpression("$PrimitiveArrayView");
  }
  if (isComplex(field.type) || field.type === "time" || field.type === "duration") {
    return complexExpression(friendlyTypeName(field.type));
  }
  // Primitives and byte arrays -- just return as-is, no bobject or null checks.
  return `return this[$value].${field.name};`;
};

// Exported for tests
export const printFieldDefinition = (field: RosMsgField): string => {
  const body = printFieldDefinitionBody(field);
  return [`${field.name}() {`, indent(body, 2), "}"].join("\n");
};

const deepParseFieldExpression = ({
  name,
  type,
  isArray,
}: {
  name: string;
  type: string;
  isArray?: boolean;
}) => {
  const isRealArray = isArray && type !== "int8" && type !== "uint8";
  const isRealComplex = isComplex(type) || type === "time" || type === "duration";
  if (isRealArray || isRealComplex) {
    return `$maybeDeepParse(this.${name}())`;
  }
  // Primitives and byte arrays -- just return as-is, no bobject or null checks.
  return `this[$value].${name}`;
};

const printClassDefinition = (typesByName: RosDatatypes, typeName: string): string => {
  const type = typesByName[typeName];
  if (type == undefined) {
    throw new Error(`Unknown type "${typeName}"`);
  }
  const fieldDefinitions = type.fields.map((field) => indent(printFieldDefinition(field), 2));

  const deepParseFieldExpressions = type.fields
    .filter(({ isConstant }) => !isConstant)
    .map((field) => `${field.name}: ${deepParseFieldExpression(field)},`);

  return `class ${friendlyTypeName(typeName)} {
  constructor(value) {
    this[$value] = value;
  }
${fieldDefinitions.join("\n")}
  [$deepParse]() {
    return {
${indent(deepParseFieldExpressions.join("\n"), 6)}
    };
  }
}
const ${arrayTypeName(typeName)} = $context.getReverseWrapperArrayView(${friendlyTypeName(
    typeName,
  )});
`;
};

// Exported for tests
export const printClasses = (inputTypesByName: RosDatatypes): string => {
  const typesByName = addTimeTypes(inputTypesByName);
  const classDefinitions = Object.keys(typesByName).map((typeName) =>
    printClassDefinition(typesByName, typeName),
  );

  const classExpressions = Object.keys(typesByName).map(
    (typeName) => `${JSON.stringify(typeName)}: ${friendlyTypeName(typeName)},`,
  );

  // Add "maybe deep parse" because `msg.field()?.[$deepParse]()` isn't supported in node.
  return `const $value = Symbol();
const $deepParse = $context.deepParse;
const $maybeDeepParse = (o) => o && o[$deepParse]()
const $PrimitiveArrayView = $context.PrimitiveArrayView;
${classDefinitions.join("\n")}

return {
${indent(classExpressions.join("\n"), 2)}
};`;
};

const getJsWrapperClasses = memoize((typesByName: RosDatatypes): {
  [typeName: string]: any;
} => {
  const context = { deepParse: deepParseSymbol, PrimitiveArrayView, getReverseWrapperArrayView };

  /* eslint-disable no-new-func */
  const classes = Function("$context", printClasses(typesByName))(context);

  /* eslint-enable no-new-func */
  Object.keys(classes).forEach((name) => {
    associateDatatypes(classes[name], [typesByName, name]);
  });
  return classes;
});

export default getJsWrapperClasses;
