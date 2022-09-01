// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import ts from "typescript/lib/typescript";

import { filterMap } from "@foxglove/den/collection";
import { Topic } from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

export type InterfaceDeclarations = {
  [datatype: string]: ts.InterfaceDeclaration;
};

const modifiers = [
  ts.factory.createModifier(ts.SyntaxKind.ExportKeyword),
  ts.factory.createModifier(ts.SyntaxKind.DeclareKeyword),
];

const createProperty = (name: string | ts.PropertyName, type: ts.TypeNode) => {
  return ts.factory.createPropertySignature(
    undefined /* modifiers */,
    name /* name */,
    undefined /* questionOrExclamationToken */,
    type /* type */,
  );
};

const createTimeInterfaceDeclaration = (name: string) => {
  return ts.factory.createInterfaceDeclaration(
    undefined /* decorators */,
    modifiers /* modifiers */,
    name /* name */,
    undefined /* typeParameters */,
    undefined /* heritageClauses */,
    [
      createProperty("sec", ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword)),
      createProperty("nsec", ts.factory.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword)),
    ] /* members */,
  );
};

// Since rosbagjs treats json as a primitive, we have to shim it in.
const jsonInterfaceDeclaration = ts.factory.createInterfaceDeclaration(
  undefined,
  /* decorators */
  modifiers,
  /* modifiers */
  "json",
  /* name */
  undefined,
  /* typeParameters */
  undefined,
  /* heritageClauses */
  [],
  /* members */
);

export const formatInterfaceName = (type: string): string => type.replace(/\//g, "__");

// http://wiki.ros.org/msg
const rosPrimitivesToTypeScriptMap = new Map<string, ts.KeywordTypeSyntaxKind>([
  ["uint8", ts.SyntaxKind.NumberKeyword],
  ["int8", ts.SyntaxKind.NumberKeyword],
  ["uint16", ts.SyntaxKind.NumberKeyword],
  ["int16", ts.SyntaxKind.NumberKeyword],
  ["uint32", ts.SyntaxKind.NumberKeyword],
  ["int32", ts.SyntaxKind.NumberKeyword],
  ["float32", ts.SyntaxKind.NumberKeyword],
  ["float64", ts.SyntaxKind.NumberKeyword],
  ["int64", ts.SyntaxKind.NumberKeyword],
  ["uint64", ts.SyntaxKind.NumberKeyword],
  ["string", ts.SyntaxKind.StringKeyword],
  ["bool", ts.SyntaxKind.BooleanKeyword],
]);

// NOTE: This list should stay in sync with rosbagjs. Exported for tests.
export const typedArrayMap = new Map<string, string>([
  ["uint8", "Uint8Array"],
  ["int8", "Int8Array"],
]);

const timeInterface = createTimeInterfaceDeclaration("Time");
const durationInterface = createTimeInterfaceDeclaration("Duration");
const rosSpecialTypesToTypescriptMap = new Map([
  ["time", timeInterface],
  ["duration", durationInterface],
]);

// Creates a 1-1 mapping of ROS datatypes to Typescript interface declarations.
export const generateTypeDefs = (datatypes: RosDatatypes): InterfaceDeclarations => {
  const interfaceDeclarations: InterfaceDeclarations = {};

  for (const [datatype, definition] of datatypes) {
    if (datatype.includes(".")) {
      // Skip newer types that are not supported by generateRosLib; these will have interfaces
      // generated via generateTypesLib and can be used that way.
      continue;
    }
    if (interfaceDeclarations[datatype]) {
      continue;
    }

    const typeMembers = filterMap(definition.definitions, ({ name, type, isArray, isConstant }) => {
      let node;
      const typedArray = typedArrayMap.get(type);
      const rosPrimitive = rosPrimitivesToTypeScriptMap.get(type);
      const rosSpecial = rosSpecialTypesToTypescriptMap.get(type);
      if (isConstant === true) {
        return undefined;
      } else if (isArray === true && typedArray != undefined) {
        node = ts.factory.createTypeReferenceNode(typedArray);
      } else if (rosPrimitive != undefined) {
        node = ts.factory.createKeywordTypeNode(rosPrimitive);
      } else if (rosSpecial) {
        node = ts.factory.createTypeReferenceNode(rosSpecial.name);
      } else {
        node = ts.factory.createTypeReferenceNode(formatInterfaceName(type));
      }
      if (isArray === true && typedArray == undefined) {
        node = ts.factory.createArrayTypeNode(node);
      }

      return createProperty(name, node);
    });

    interfaceDeclarations[datatype] = ts.factory.createInterfaceDeclaration(
      undefined /* decorators */,
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)] /* modifiers */,
      formatInterfaceName(datatype) /* name */,
      undefined /* typeParameters */,
      undefined /* heritageClauses */,
      typeMembers /* members */,
    );
  }

  return interfaceDeclarations;
};

// Creates the entire ros.d.ts declaration file.
const generateRosLib = ({
  topics,
  datatypes,
}: {
  topics: Topic[];
  datatypes: RosDatatypes;
}): string => {
  let TopicsToMessageDefinition = ts.factory.createInterfaceDeclaration(
    undefined,
    modifiers,
    "TopicsToMessageDefinition",
    undefined,
    undefined,
    [],
  );

  const typedMessage = ts.factory.createInterfaceDeclaration(
    undefined,
    /* decorators */
    modifiers,
    /* modifiers */
    "Input",
    /* name */
    [
      ts.factory.createTypeParameterDeclaration(
        [],
        "T",
        ts.factory.createTypeOperatorNode(
          ts.SyntaxKind.KeyOfKeyword,
          ts.factory.createTypeReferenceNode(TopicsToMessageDefinition.name),
        ),
      ),
    ],
    /* typeParameters */
    undefined,
    /* heritageClauses */
    [
      createProperty("topic", ts.factory.createTypeReferenceNode("T")),
      createProperty("receiveTime", ts.factory.createTypeReferenceNode("Time")),
      createProperty("message", ts.factory.createTypeReferenceNode("TopicsToMessageDefinition[T]")),
    ],
    /* members */
  );

  const DATATYPES_IDENTIFIER = "Messages";

  let datatypeInterfaces = generateTypeDefs(datatypes);

  topics.forEach(({ name, datatype }) => {
    if (!datatypeInterfaces[datatype]) {
      datatypeInterfaces = {
        ...datatypeInterfaces,
        ...generateTypeDefs(new Map(Object.entries({ [datatype]: { definitions: [] } }))),
      };
    }

    TopicsToMessageDefinition = ts.factory.updateInterfaceDeclaration(
      TopicsToMessageDefinition,
      /* node */
      undefined,
      /* decorators */
      modifiers,
      /* modifiers */
      TopicsToMessageDefinition.name,
      undefined,
      /* typeParameters */
      undefined,
      /* heritageClauses */
      [
        ...TopicsToMessageDefinition.members,
        createProperty(
          ts.factory.createStringLiteral(name),
          ts.factory.createTypeReferenceNode(
            `${DATATYPES_IDENTIFIER}.${formatInterfaceName(datatype)}`,
          ),
        ),
      ],
      /* members */
    );
  });

  const datatypesNamespace = ts.factory.createModuleDeclaration(
    undefined,
    /* decorators */
    modifiers,
    /* modifiers */
    ts.factory.createIdentifier(DATATYPES_IDENTIFIER),
    ts.factory.createModuleBlock(
      Object.values(datatypeInterfaces).map((val) => {
        return val;
      }),
    ),
    ts.NodeFlags.Namespace,
  );

  const sourceFile = ts.createSourceFile(
    "", // This argument doesn't really matter.
    "",
    /* sourceText */
    ts.ScriptTarget.Latest,
    false,
    /* setParentNodes */
    ts.ScriptKind.TS,
    /* scriptKind */
  );

  // The following formatting could be accomplished with `printer.printList`,
  // however adding inline comments this way was easier.
  const printer = ts.createPrinter();
  const result = `
    ${printer.printNode(ts.EmitHint.Unspecified, jsonInterfaceDeclaration, sourceFile)}
    ${printer.printNode(ts.EmitHint.Unspecified, TopicsToMessageDefinition, sourceFile)}
    ${printer.printNode(ts.EmitHint.Unspecified, durationInterface, sourceFile)}
    ${printer.printNode(ts.EmitHint.Unspecified, timeInterface, sourceFile)}

    /**
     * This type contains every message declaration in your bag, so that you can
     * refer to the type "std_msgs/RGBA" as "std_msgs__RGBA" wherever you like.
     */
    ${printer.printNode(ts.EmitHint.Unspecified, datatypesNamespace, sourceFile)}

    /**
     * To correctly type your inputs, you use this type to refer to specific
     * input topics, e.g. 'Input<"/your_input_topic">'. If you have
     * multiple input topics, use a union type, e.g.
     * 'Input<"/your_input_topic_1"> |
     * Input<"/your_input_topic_2">'.
     *
     * These types are dynamically generated from the bag(s) currently in your
     * Foxglove Studio session, so if a datatype changes, your User Script
     * may not compile on the newly formatted bag.
     */
    ${printer.printNode(ts.EmitHint.Unspecified, typedMessage, sourceFile)}
  `;

  return result;
};

export default generateRosLib;
