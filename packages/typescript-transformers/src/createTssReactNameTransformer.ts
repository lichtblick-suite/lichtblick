// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ts from "typescript";

/** Returns true if `node` refers to a symbol that was imported from a module named `targetModule`. */
function isImportedFrom(node: ts.Node, targetModule: string, program: ts.Program) {
  for (const declaration of program.getTypeChecker().getSymbolAtLocation(node)?.getDeclarations() ??
    []) {
    if (ts.isImportSpecifier(declaration)) {
      const module = ts.findAncestor(declaration, ts.isImportDeclaration)?.moduleSpecifier;
      if (module && ts.isStringLiteral(module) && module.text === targetModule) {
        return true;
      }
    }
  }
  return false;
}

/**
 * When `makeStyles` is imported from `tss-react/mui`, this transforms `makeStyles()` into
 * `makeStyles({ name })`, where name is derived from the source file path.
 */
export function createTssReactNameTransformer(
  program: ts.Program,
): ts.TransformerFactory<ts.SourceFile> {
  return (context) => (sourceFile) => {
    const visitor = (node: ts.Node): ts.Node => {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "makeStyles" &&
        node.arguments.length === 0 &&
        isImportedFrom(node.expression, "tss-react/mui", program)
      ) {
        const sanitizedFilename = sourceFile.fileName
          .replace(/^.*packages\/[^/]*\//, "")
          .replace(/[^a-zA-Z0-9_-]/g, "_");
        return context.factory.updateCallExpression(node, node.expression, node.typeArguments, [
          context.factory.createObjectLiteralExpression([
            context.factory.createPropertyAssignment(
              "name",
              context.factory.createStringLiteral(sanitizedFilename),
            ),
          ]),
        ]);
      }
      return ts.visitEachChild(node, visitor, context);
    };
    return ts.visitNode(sourceFile, visitor);
  };
}
