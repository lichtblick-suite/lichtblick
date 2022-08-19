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

import { RosMsgField } from "@foxglove/rosmsg";
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
  public diagnostic: Diagnostic;
  public constructor(diagnostic: Diagnostic) {
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
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
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
  typeChecker: ts.TypeChecker,
  node: ts.Node,
): ts.TypeLiteralNode | ts.InterfaceDeclaration => {
  const resolveType = typeChecker.getTypeAtLocation(node);

  const signatures = resolveType.getCallSignatures();
  const signature = signatures[0];
  if (signatures.length !== 1 || !signature) {
    throw new DatatypeExtractionError(nonFuncError);
  }

  const fullReturnType = typeChecker.getReturnTypeOfSignature(signature);
  const nonNullable = fullReturnType.getNonNullableType();

  // In some future we could support intersection types where all the fields are known
  if (nonNullable.isIntersection()) {
    throw new DatatypeExtractionError(noIntersectionTypesError);
  } else if (nonNullable.isClass()) {
    throw new DatatypeExtractionError(classError);
  } else if (nonNullable.isUnion()) {
    throw new DatatypeExtractionError(limitedUnionsError);
  }

  const symbol = nonNullable.getSymbol();
  if (!symbol) {
    throw new DatatypeExtractionError(badTypeReturnError);
  }

  if (!symbol.declarations || symbol.declarations.length === 0) {
    throw new DatatypeExtractionError(badTypeReturnError);
  }

  // If there are multiple declarations for the symbol, filter down to only
  // the interface ones. However, if there is only one, use that one to provide better errors
  let declaration: ts.Declaration | undefined;
  if (symbol.declarations.length === 1) {
    declaration = symbol.declarations[0];
  } else {
    declaration = symbol.declarations.filter(
      (decl) => decl.kind === ts.SyntaxKind.InterfaceDeclaration,
    )[0];
  }

  if (!declaration) {
    throw new DatatypeExtractionError(badTypeReturnError);
  }

  if (ts.isTypeLiteralNode(declaration)) {
    return declaration;
  } else if (ts.isInterfaceDeclaration(declaration)) {
    return declaration;
  } else if (ts.isMappedTypeNode(declaration)) {
    throw new DatatypeExtractionError(noMappedTypes);
  } else if (ts.isClassDeclaration(declaration)) {
    throw new DatatypeExtractionError(classError);
  } else if (ts.isFunctionLike(declaration)) {
    throw new DatatypeExtractionError(functionError);
  }

  throw new DatatypeExtractionError(badTypeReturnError);
};

export const constructDatatypes = (
  checker: ts.TypeChecker,
  node: ts.TypeLiteralNode | ts.InterfaceDeclaration,
  currentDatatype: string,
  messageDefinitionMap: { [formattedDatatype: string]: string },
  sourceDatatypes: RosDatatypes,
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
      datatypes: sourceDatatypes,
    };
  }

  // In this case, we've detected that the return type comes from the generated types file.
  // We can look up the datatype name by finding it in the file. The name will be the property name
  // under which the type exists.
  if (node.getSourceFile().fileName === "/studio_script/generatedTypes.ts") {
    if (ts.isPropertySignature(node.parent) && ts.isStringLiteral(node.parent.name)) {
      const datatype = node.parent.name.text;
      return {
        outputDatatype: datatype,
        datatypes: sourceDatatypes,
      };
    }
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

        const messageDefinition =
          symbolName != undefined ? messageDefinitionMap[symbolName] : undefined;

        const nestedType =
          isNodeFromRosModule(typeLiteral) && messageDefinition != undefined
            ? messageDefinition
            : `${currentDatatype}/${name}`;

        const typeParamMap = ts.isInterfaceDeclaration(tsNode)
          ? buildTypeMapFromParams(tsNode.typeParameters, typeMap)
          : typeMap;

        const { datatypes: nestedDatatypes } = constructDatatypes(
          checker,
          typeLiteral,
          nestedType,
          messageDefinitionMap,
          sourceDatatypes,
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

      default: {
        const locationType = checker.getTypeAtLocation(tsNode);

        const symbol = locationType.symbol;
        const declaration = symbol.declarations?.[0];
        if (symbol.declarations?.length !== 1 || !declaration) {
          throw new DatatypeExtractionError(badTypeReturnError);
        }

        return getRosMsgField(name, declaration, false, undefined, typeMap, innerDepth + 1);
      }
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
