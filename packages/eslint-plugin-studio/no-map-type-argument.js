// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

const { ESLintUtils } = require("@typescript-eslint/utils");

/**
 * @type {import("eslint").Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: "problem",
    fixable: "code",
    messages: {
      preferReturnTypeAnnotation: `Annotate the function return type explicitly instead of passing generic arguments to Array#map, to avoid return type widening (https://github.com/microsoft/TypeScript/issues/241)`,
    },
  },
  create: (context) => {
    return {
      [`CallExpression[arguments.length>=1][typeArguments.params.length=1][arguments.0.type=ArrowFunctionExpression]:not([arguments.0.returnType]) > MemberExpression.callee[property.name="map"]`]:
        (/** @type {import("estree").MemberExpression} */ node) => {
          /** @type {import("estree").CallExpression} */
          const callExpr = node.parent;

          const { esTreeNodeToTSNodeMap, program } = ESLintUtils.getParserServices(context);
          const sourceCode = context.getSourceCode();
          const checker = program.getTypeChecker();
          const objectTsNode = esTreeNodeToTSNodeMap.get(node.object);
          const objectType = checker.getTypeAtLocation(objectTsNode);
          if (!checker.isArrayType(objectType) && !checker.isTupleType(objectType)) {
            return;
          }

          const arrowToken = sourceCode.getTokenBefore(
            callExpr.arguments[0].body,
            (token) => token.type === "Punctuator" && token.value === "=>",
          );
          if (!arrowToken) {
            return;
          }
          const maybeCloseParenToken = sourceCode.getTokenBefore(arrowToken);
          const closeParenToken =
            maybeCloseParenToken.type === "Punctuator" && maybeCloseParenToken.value === ")"
              ? maybeCloseParenToken
              : undefined;

          context.report({
            node: callExpr.typeArguments,
            messageId: "preferReturnTypeAnnotation",
            *fix(fixer) {
              const returnType = sourceCode.getText(callExpr.typeArguments.params[0]);
              yield fixer.remove(callExpr.typeArguments);
              if (closeParenToken) {
                yield fixer.insertTextAfter(closeParenToken, `: ${returnType}`);
              } else {
                yield fixer.insertTextBefore(callExpr.arguments[0], "(");
                yield fixer.insertTextAfter(
                  callExpr.arguments[0].params[callExpr.arguments[0].params.length - 1],
                  `): ${returnType}`,
                );
              }
            },
          });
        },
    };
  },
};
