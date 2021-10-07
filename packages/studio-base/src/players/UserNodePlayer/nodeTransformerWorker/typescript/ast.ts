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

import { without } from "lodash";
import ts from "typescript/lib/typescript";

import { RosMsgField } from "@foxglove/rosmsg";
import baseDatatypes from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/baseDatatypes";
import {
  noFuncError,
  nonFuncError,
  badTypeReturnError,
  unionsError,
  functionError,
  noTypeLiteralsError,
  noIntersectionTypesError,
  preferArrayLiteral,
  classError,
  noTypeOfError,
  noMappedTypes,
  noTuples,
  limitedUnionsError,
  noNestedAny,
  invalidIndexedAccessError,
} from "@foxglove/studio-base/players/UserNodePlayer/nodeTransformerWorker/typescript/errors";
import {
  DiagnosticSeverity,
  Sources,
  ErrorCodes,
  Diagnostic,
} from "@foxglove/studio-base/players/UserNodePlayer/types";
import type { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

type TypeParam = {
  parent?: TypeParam;
  current?: ts.TypeParameterDeclaration | ts.TypeNode;
};

type TypeMap = {
  [key: string]: TypeParam;
};

// Ensures our recursive AST traversals don't too far down.
const MAX_DEPTH = 100;

// This class of error is explicitly for users debugging within NodePlayground.
// In other words, it is the **known** set of errors. Since this error class requires
// diagnostic information, it will enable users to figure out where their code
// has broken according to our rules. It should **not** be used in code paths where we cannot
// provide any helpful debugging information to the user. In the event we come across an unknown
// error class, just throw a regular error. This error will be reported in the notification tab
// as a true error, so that users can inform us when things are truly broken.
export class DatatypeExtractionError extends Error {
  diagnostic: Diagnostic;
  constructor(diagnostic: Diagnostic) {
    super();
    this.diagnostic = diagnostic;
  }
}

export const findChild = (node: ts.Node, kind: ts.SyntaxKind[]): ts.Node | undefined =>
  ts.forEachChild(node, (child) => {
    if (kind.includes(child.kind)) {
      return child;
    }
    return undefined;
  });

// Symbols can have multiple declarations associated with them. For instance,
// `const myType = 'my-type';` and `type myType = string` would map to the same
// symbol. In those instances, we should ideally search through the declarations
// on a symbol to explicitly find what we are looking for.
export const findDeclaration = (symbol: ts.Symbol, kind: ts.SyntaxKind[]): ts.Node | undefined => {
  for (const declaration of symbol.declarations ?? []) {
    if (kind.includes(declaration.kind)) {
      return declaration;
    }
  }
  return undefined;
};

const findImportedTypeDeclaration = (
  checker: ts.TypeChecker,
  node: ts.Node,
  kind: ts.SyntaxKind[],
): ts.Node | undefined => {
  const symbol = maybeSymbol(node);
  if (!symbol) {
    return undefined;
  }

  const declaredType = checker.getDeclaredTypeOfSymbol(symbol);
  return findDeclaration(declaredType.symbol ?? declaredType.aliasSymbol, kind);
};

// These functions are used to build up mapping for generic types.
const buildTypeMapFromParams = (
  typeParameters: readonly ts.TypeParameterDeclaration[] = [],
  typeMap: TypeMap,
): TypeMap => {
  const newTypeParamMap: TypeMap = {};
  for (let i = 0; i < typeParameters.length; i++) {
    const currentParam = typeParameters[i];
    if (!currentParam) {
      continue;
    }
    newTypeParamMap[currentParam.name.escapedText.toString()] = {
      current: currentParam,
      parent: typeMap[i] ?? { parent: undefined, current: currentParam.default },
    };
  }
  return newTypeParamMap;
};

const buildTypeMapFromArgs = (
  typeArguments: readonly ts.TypeNode[] = [],
  typeMap: TypeMap,
): TypeMap => {
  const newTypeParamMap: TypeMap = {};
  typeArguments.forEach((typeArg, i) => {
    const text = typeArg.getText();
    const parent = typeMap[text] ?? typeMap[i];
    const current = typeArg;
    newTypeParamMap[i] = { current, parent };
  });
  return newTypeParamMap;
};

const isNodeFromRosModule = (node: ts.TypeLiteralNode | ts.InterfaceDeclaration): boolean => {
  return node.getSourceFile().fileName.endsWith("ros/index.d.ts");
};

function maybeSymbol(node: ts.Node): ts.Symbol | undefined {
  return (node as unknown as ts.Type | undefined)?.symbol;
}

export const findDefaultExportFunction = (
  source: ts.SourceFile,
  checker: ts.TypeChecker,
): ts.Node | undefined => {
  const symbol = maybeSymbol(source);
  if (!symbol) {
    return undefined;
  }

  const defaultExportSymbol = checker
    .getExportsOfModule(symbol)
    .find((node) => node.escapedName === "default");
  if (!defaultExportSymbol) {
    throw new DatatypeExtractionError(noFuncError);
  }

  const functionDeclarationNode = findDeclaration(defaultExportSymbol, [
    ts.SyntaxKind.FunctionDeclaration,
  ]);
  if (functionDeclarationNode) {
    return functionDeclarationNode;
  }

  const exportAssignmentNode = findDeclaration(defaultExportSymbol, [
    ts.SyntaxKind.ExportAssignment,
  ]);

  if (!exportAssignmentNode) {
    throw new DatatypeExtractionError(noFuncError);
  }

  const exportedNode = findChild(exportAssignmentNode, [
    ts.SyntaxKind.FunctionDeclaration,
    ts.SyntaxKind.FunctionExpression,
    ts.SyntaxKind.ArrowFunction,
    ts.SyntaxKind.Identifier,
  ]);

  if (!exportedNode) {
    throw new DatatypeExtractionError(nonFuncError);
  }

  return exportedNode;
};

export const findReturnType = (
  checker: ts.TypeChecker,
  depth: number = 1,
  node: ts.Node,
): ts.TypeLiteralNode | ts.InterfaceDeclaration => {
  if (depth > MAX_DEPTH) {
    throw new Error(`Max AST traversal depth exceeded ${MAX_DEPTH}.`);
  }

  const visitNext = findReturnType.bind(undefined, checker, depth + 1);

  switch (node.kind) {
    case ts.SyntaxKind.TypeLiteral:
      return node as ts.TypeLiteralNode;
    case ts.SyntaxKind.InterfaceDeclaration:
      return node as ts.InterfaceDeclaration;
    case ts.SyntaxKind.ArrowFunction: {
      const nextNode = findChild(node, [
        ts.SyntaxKind.TypeReference,
        ts.SyntaxKind.TypeLiteral,
        ts.SyntaxKind.IntersectionType, // Unhandled type--let next recursive call handle error.
        ts.SyntaxKind.UnionType,
        ts.SyntaxKind.IndexedAccessType,
      ]);
      if (nextNode) {
        return visitNext(nextNode);
      }
      throw new DatatypeExtractionError(badTypeReturnError);
    }
    case ts.SyntaxKind.Identifier: {
      const symbol = checker.getSymbolAtLocation(node);
      if (!symbol?.valueDeclaration) {
        throw new DatatypeExtractionError(nonFuncError);
      }
      return visitNext(symbol.valueDeclaration);
    }
    case ts.SyntaxKind.VariableDeclaration: {
      const nextNode = findChild(node, [ts.SyntaxKind.TypeReference, ts.SyntaxKind.ArrowFunction]);
      if (!nextNode) {
        throw new DatatypeExtractionError(nonFuncError);
      }
      return visitNext(nextNode);
    }
    case ts.SyntaxKind.TypeReference: {
      const typeRef = node as ts.TypeReferenceNode;
      const symbol = checker.getSymbolAtLocation(typeRef.typeName);
      if (!symbol) {
        throw new DatatypeExtractionError(badTypeReturnError);
      }
      const nextNode = findDeclaration(symbol, [
        ts.SyntaxKind.TypeAliasDeclaration,
        ts.SyntaxKind.InterfaceDeclaration,
        ts.SyntaxKind.ClassDeclaration,
        ts.SyntaxKind.ImportSpecifier,
      ]);
      if (!nextNode) {
        throw new DatatypeExtractionError(badTypeReturnError);
      }
      return visitNext(nextNode);
    }
    case ts.SyntaxKind.FunctionDeclaration: {
      const nextNode = findChild(node, [ts.SyntaxKind.TypeReference, ts.SyntaxKind.TypeLiteral]);
      if (!nextNode) {
        throw new DatatypeExtractionError(badTypeReturnError);
      }
      return visitNext(nextNode);
    }
    case ts.SyntaxKind.FunctionType: {
      return visitNext((node as ts.FunctionTypeNode).type);
    }
    case ts.SyntaxKind.TypeAliasDeclaration: {
      return visitNext((node as ts.TypeAliasDeclaration).type);
    }
    case ts.SyntaxKind.ImportSpecifier: {
      const declaration = findImportedTypeDeclaration(checker, node, [
        ts.SyntaxKind.TypeLiteral,
        ts.SyntaxKind.InterfaceDeclaration,
      ]);
      if (!declaration) {
        throw new DatatypeExtractionError(badTypeReturnError);
      }
      return visitNext(declaration);
    }

    case ts.SyntaxKind.IndexedAccessType: {
      const indexedNode = node as ts.IndexedAccessTypeNode;
      const declaration = visitNext(indexedNode.objectType);

      if (!ts.isLiteralTypeNode(indexedNode.indexType)) {
        throw new DatatypeExtractionError({
          ...invalidIndexedAccessError,
          message: "Indexed access is only allowed with string literal indexes",
        });
      }
      if (!ts.isStringLiteral(indexedNode.indexType.literal)) {
        throw new DatatypeExtractionError({
          ...invalidIndexedAccessError,
          message: "Indexed access is only allowed with string literal indexes",
        });
      }
      const indexedProperty = indexedNode.indexType.literal.text;

      const next = declaration.members.find((member): member is ts.PropertySignature => {
        return (
          ts.isPropertySignature(member) &&
          (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name)) &&
          member.name.text === indexedProperty
        );
      });
      if (!next || !next.type) {
        throw new DatatypeExtractionError({
          ...invalidIndexedAccessError,
          message: `Couldn't find member ${indexedProperty} in indexed access`,
        });
      }
      return visitNext(next.type);
    }

    case ts.SyntaxKind.TypeQuery:
      throw new DatatypeExtractionError(noTypeOfError);

    case ts.SyntaxKind.MappedType:
      throw new DatatypeExtractionError(noMappedTypes);

    case ts.SyntaxKind.AnyKeyword:
    case ts.SyntaxKind.LiteralType: {
      throw new DatatypeExtractionError(badTypeReturnError);
    }
    case ts.SyntaxKind.IntersectionType:
      throw new DatatypeExtractionError(noIntersectionTypesError);
    case ts.SyntaxKind.ClassDeclaration: {
      throw new DatatypeExtractionError(classError);
    }
    case ts.SyntaxKind.UnionType: {
      const remainingTypes = (node as ts.UnionTypeNode).types.filter(
        ({ kind }) => kind !== ts.SyntaxKind.UndefinedKeyword,
      );
      if (remainingTypes.length !== 1) {
        throw new DatatypeExtractionError(limitedUnionsError);
      }
      const remaining = remainingTypes[0];
      if (!remaining) {
        throw new DatatypeExtractionError(badTypeReturnError);
      }
      return visitNext(remaining);
    }
    default:
      throw new Error("Unhandled node kind.");
  }
};

export const constructDatatypes = (
  checker: ts.TypeChecker,
  node: ts.TypeLiteralNode | ts.InterfaceDeclaration,
  currentDatatype: string,
  messageDefinitionMap: { [formattedDatatype: string]: string },
  depth: number = 1,
  currentTypeParamMap: TypeMap = {},
): { outputDatatype: string; datatypes: RosDatatypes } => {
  if (depth > MAX_DEPTH) {
    throw new Error(`Max AST traversal depth exceeded.`);
  }

  // In the case that the user has specified a dynamically generated message
  // definition, we can check whether it exists in the 'ros' module and just
  // return the ros-specific definition, e.g. 'std_msgs/ColorRGBA', instead of
  // our own definition. This allows user nodes to operate much more freely.
  const interfaceName = ts.isInterfaceDeclaration(node) ? node.name.text : undefined;
  const messageDef = interfaceName != undefined ? messageDefinitionMap[interfaceName] : undefined;
  if (isNodeFromRosModule(node) && messageDef != undefined) {
    return {
      outputDatatype: messageDef,
      datatypes: baseDatatypes,
    };
  }

  // TODO: Remove when we remove DEPRECATED__ros. Hardcoded 'visualization_msgs/MarkerArray' flow.
  const memberKeys = node.members.map(({ name }) => name?.getText());
  if (memberKeys.includes("markers")) {
    if (memberKeys.length > 1) {
      throw new DatatypeExtractionError({
        severity: DiagnosticSeverity.Error,
        message: `For marker return types, they must have only one property 'markers'. Please remove '${without(
          memberKeys,
          "markers",
        ).join(", ")}', or rename 'markers'.`,
        source: Sources.DatatypeExtraction,
        code: ErrorCodes.DatatypeExtraction.STRICT_MARKERS_RETURN_TYPE,
      });
    }

    return {
      outputDatatype: "visualization_msgs/MarkerArray",
      datatypes: baseDatatypes,
    };
  }

  let datatypes: RosDatatypes = new Map();

  const getRosMsgField = (
    name: string,
    tsNode: ts.Node,
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    isArray: boolean = false,
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    isComplex: boolean = false,
    typeMap: TypeMap = {},
    innerDepth: number = 1,
  ): RosMsgField => {
    if (innerDepth > MAX_DEPTH) {
      throw new Error(`Max AST traversal depth exceeded.`);
    }

    switch (tsNode.kind) {
      case ts.SyntaxKind.InterfaceDeclaration:
      case ts.SyntaxKind.TypeLiteral: {
        const typeLiteral = tsNode as ts.TypeLiteralNode;
        const symbolName = maybeSymbol(tsNode)?.name;

        // The 'json' type is special because rosbagjs represents it as a primitive field
        if (isNodeFromRosModule(typeLiteral) && symbolName === "json") {
          return {
            name,
            type: "json",
            isArray: false,
            isComplex: false,
            arrayLength: undefined,
          };
        }

        const messageDefinition =
          symbolName != undefined ? messageDefinitionMap[symbolName] : undefined;

        const nestedType =
          isNodeFromRosModule(typeLiteral) && messageDefinition != undefined
            ? messageDefinition
            : `${currentDatatype}/${name}`;

        if (nestedType == undefined) {
          throw new Error("could not find nested type");
        }

        const typeParamMap = ts.isInterfaceDeclaration(tsNode)
          ? buildTypeMapFromParams(tsNode.typeParameters, typeMap)
          : typeMap;

        const { datatypes: nestedDatatypes } = constructDatatypes(
          checker,
          typeLiteral,
          nestedType,
          messageDefinitionMap,
          depth + 1,
          typeParamMap,
        );
        const childFields = nestedDatatypes.get(nestedType)?.definitions ?? [];
        if (childFields.length === 2) {
          const secField = childFields.find((field) => field.name === "sec");
          const nsecField = childFields.find((field) => field.name === "nsec");
          if (
            secField &&
            nsecField &&
            secField.isComplex !== true &&
            nsecField.isComplex !== true &&
            secField.isArray !== true &&
            nsecField.isArray !== true
          ) {
            // TODO(JP): Might want to do some extra checks for types here. But then again,
            // "time" is just pretty awkward of a field in general; maybe we should instead
            // just get rid of it throughout our application and treat it as a regular nested object?
            return {
              name,
              type: "time",
              isArray: false,
              isComplex: false,
              arrayLength: undefined,
            };
          }
        }

        datatypes = new Map([...datatypes, ...nestedDatatypes]);
        return {
          name,
          type: nestedType,
          isArray,
          isComplex: true,
          arrayLength: undefined,
        };
      }

      case ts.SyntaxKind.ArrayType: {
        const arrayNode = tsNode as ts.ArrayTypeNode;
        return getRosMsgField(name, arrayNode.elementType, true, true, typeMap, innerDepth + 1);
      }

      case ts.SyntaxKind.BigIntKeyword:
        // bigint has no distinction for signed or unsigned so we've selected int64 for the datatype
        return {
          name,
          type: "int64",
          isArray,
          isComplex,
          arrayLength: undefined,
        };
      case ts.SyntaxKind.NumberKeyword:
        return {
          name,
          type: "float64",
          isArray,
          isComplex,
          arrayLength: undefined,
        };
      case ts.SyntaxKind.StringKeyword:
        return {
          name,
          type: "string",
          isArray,
          isComplex,
          arrayLength: undefined,
        };
      case ts.SyntaxKind.BooleanKeyword:
        return {
          name,
          type: "bool",
          isArray,
          isComplex,
          arrayLength: undefined,
        };

      case ts.SyntaxKind.TypeAliasDeclaration: {
        const typeAlias = tsNode as ts.TypeAliasDeclaration;
        const newTypeParamMap = buildTypeMapFromParams(typeAlias.typeParameters, typeMap);
        return getRosMsgField(
          name,
          typeAlias.type,
          isArray,
          isComplex,
          newTypeParamMap,
          innerDepth + 1,
        );
      }

      case ts.SyntaxKind.TypeReference: {
        const typeRef = tsNode as ts.TypeReferenceNode;
        const nextSymbol = checker.getSymbolAtLocation(typeRef.typeName);

        // There is a troubling discrepancy between how Typescript defines
        // array literals 'number[]' and arrays of the form 'Array<number>'.
        // In the latter case, as is handled here, 'Array' actually refers to
        // the 'lib.d.ts' declaration of 'Array', which puts into a bit of a
        // rabbit hole in terms of coming up with an appropriate ROS datatype.
        // One solution could potentially to 'cast' this node as an
        // ArrayTypeNode and recurse. Opting out of using 'Array' keyword for
        // now.
        if (nextSymbol?.escapedName === "Array") {
          throw new DatatypeExtractionError(preferArrayLiteral);
        }

        if (!nextSymbol) {
          throw new Error("Could not find symbol");
        }

        const typeParam = findDeclaration(nextSymbol, [ts.SyntaxKind.TypeParameter]) as
          | ts.TypeParameterDeclaration
          | undefined;

        if (typeParam) {
          if (typeMap[typeParam.name.escapedText.toString()]) {
            let next = typeMap[typeParam.name.escapedText.toString()];
            while (next?.parent) {
              next = next.parent;
            }
            return getRosMsgField(
              name,
              next!.current!,
              isArray,
              isComplex,
              typeMap,
              innerDepth + 1,
            );
          }
          throw new Error(`Could not find type ${typeParam.getText()} in type map.`);
        }

        const nextNode = findDeclaration(nextSymbol, [
          ts.SyntaxKind.TypeAliasDeclaration,
          ts.SyntaxKind.InterfaceDeclaration,
          ts.SyntaxKind.ImportSpecifier,
          ts.SyntaxKind.ClassDeclaration,
        ]);

        if (!nextNode) {
          throw new Error("Could not find next node");
        }

        return getRosMsgField(
          name,
          nextNode,
          isArray,
          isComplex,
          buildTypeMapFromArgs(typeRef.typeArguments, typeMap),
          innerDepth + 1,
        );
      }
      // i.e. 'typeof'
      case ts.SyntaxKind.TypeQuery: {
        throw new DatatypeExtractionError(noTypeOfError);
      }

      case ts.SyntaxKind.ImportSpecifier: {
        const declaration = findImportedTypeDeclaration(checker, tsNode, [
          ts.SyntaxKind.TypeLiteral,
          ts.SyntaxKind.InterfaceDeclaration,
          ts.SyntaxKind.TypeAliasDeclaration,
        ]);

        if (!declaration) {
          throw new Error("Failed to find import declaration");
        }

        return getRosMsgField(name, declaration, isArray, isComplex, typeMap, innerDepth + 1);
      }
      case ts.SyntaxKind.IntersectionType: {
        throw new DatatypeExtractionError(noIntersectionTypesError);
      }
      case ts.SyntaxKind.TupleType: {
        throw new DatatypeExtractionError(noTuples);
      }
      case ts.SyntaxKind.StringLiteral:
      case ts.SyntaxKind.NumericLiteral:
      case ts.SyntaxKind.LiteralType: {
        throw new DatatypeExtractionError(noTypeLiteralsError);
      }
      case ts.SyntaxKind.ClassDeclaration: {
        throw new DatatypeExtractionError(classError);
      }

      case ts.SyntaxKind.UnionType: {
        throw new DatatypeExtractionError(unionsError);
      }
      case ts.SyntaxKind.FunctionType:
        throw new DatatypeExtractionError(functionError);

      case ts.SyntaxKind.AnyKeyword:
        throw new DatatypeExtractionError(noNestedAny);

      default:
        throw new Error(`Unhandled node kind (${tsNode.kind}) for field (${name})`);
    }
  };

  const { members = [] } = node;
  const rosMsgFields = members.map((member) => {
    if (!member.name) {
      throw new DatatypeExtractionError({
        severity: DiagnosticSeverity.Error,
        message: `Encountered type member with no name in ${interfaceName ?? currentDatatype}`,
        source: Sources.DatatypeExtraction,
        code: ErrorCodes.DatatypeExtraction.INVALID_PROPERTY,
      });
    }
    if (!ts.isPropertySignature(member)) {
      throw new DatatypeExtractionError({
        severity: DiagnosticSeverity.Error,
        message: `Unexpected type member (kind ${member.kind}) in ${
          interfaceName ?? currentDatatype
        }`,
        source: Sources.DatatypeExtraction,
        code: ErrorCodes.DatatypeExtraction.INVALID_PROPERTY,
      });
    }
    if (!member.type) {
      throw new DatatypeExtractionError({
        severity: DiagnosticSeverity.Error,
        message: `Member ${member.name.getText()} has no type in ${
          interfaceName ?? currentDatatype
        }`,
        source: Sources.DatatypeExtraction,
        code: ErrorCodes.DatatypeExtraction.INVALID_PROPERTY,
      });
    }
    return getRosMsgField(
      member.name.getText(),
      member.type,
      false,
      false,
      currentTypeParamMap,
      depth + 1,
    );
  });

  return {
    outputDatatype: currentDatatype,
    datatypes: new Map([
      ...datatypes,
      ...new Map([[currentDatatype, { definitions: rosMsgFields }]]),
    ]),
  };
};
