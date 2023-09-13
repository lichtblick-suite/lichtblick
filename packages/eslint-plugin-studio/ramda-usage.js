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
      useMath: `Use built-in Math.{{name}} instead of R.{{name}} when applying arguments directly`,
      useArrayMap: `Use built-in Array#map instead of R.map`,
    },
  },
  create: (context) => {
    return {
      /**
       * Transform `R.min/max(a, b)` to `Math.min/max(a, b)`
       */
      [`CallExpression[arguments.length=2] > MemberExpression.callee[object.name="R"]:matches([property.name="min"], [property.name="max"])`]:
        (/** @type {import("estree").MemberExpression} */ node) => {
          context.report({
            node,
            messageId: "useMath",
            data: { name: node.property.name },
            fix(fixer) {
              return fixer.replaceText(node.object, "Math");
            },
          });
        },

      /**
       * Transform `R.map(fn, array)` to `array.map(fn)`
       */
      [`CallExpression[arguments.length=2] > MemberExpression.callee[object.name="R"][property.name="map"]`]:
        (/** @type {import("estree").MemberExpression} */ node) => {
          /** @type {import("estree").CallExpression} */
          const callExpr = node.parent;
          const { esTreeNodeToTSNodeMap, program } = ESLintUtils.getParserServices(context);
          const sourceCode = context.getSourceCode();
          const checker = program.getTypeChecker();
          const tsNode = esTreeNodeToTSNodeMap.get(callExpr.arguments[1]);
          const type = checker.getTypeAtLocation(tsNode);
          if (!checker.isArrayType(type) && !checker.isTupleType(type)) {
            return;
          }
          context.report({
            node: callExpr,
            messageId: "useArrayMap",
            fix(fixer) {
              return fixer.replaceText(
                callExpr,
                // Add parentheses indiscriminately, leave it to prettier to clean up
                `(${sourceCode.getText(callExpr.arguments[1])}).map(${sourceCode.getText(
                  callExpr.arguments[0],
                )})`,
              );
            },
          });
        },
    };
  },
};
