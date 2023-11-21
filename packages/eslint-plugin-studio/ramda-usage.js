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
      useMath: `Use built-in Math.{{name}} instead of R.{{name}}`,
      useObject: `Use built-in Object.{{name}} instead of R.{{name}}`,
      useArrayMethod: `Use built-in Array#{{arrayName}} instead of R.{{ramdaName}}`,
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
       * Transform `R.keys/values(a)` to `Object.keys/values(a)`
       */
      [`CallExpression[arguments.length=1] > MemberExpression.callee[object.name="R"]:matches([property.name="keys"], [property.name="values"])`]:
        (/** @type {import("estree").MemberExpression} */ node) => {
          context.report({
            node,
            messageId: "useObject",
            data: { name: node.property.name },
            fix(fixer) {
              return fixer.replaceText(node.object, "Object");
            },
          });
        },

      /**
       * Transform `R.all/any(fn, array)` to `array.every/some(fn)`
       */
      [`CallExpression[arguments.length=2] > MemberExpression.callee[object.name="R"]:matches([property.name="all"], [property.name="any"])`]:
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
          const arrayName = node.property.name === "all" ? "every" : "some";
          context.report({
            node: callExpr,
            messageId: "useArrayMethod",
            data: {
              arrayName,
              ramdaName: node.property.name,
            },
            fix(fixer) {
              return fixer.replaceText(
                callExpr,
                // Add parentheses indiscriminately, leave it to prettier to clean up
                `(${sourceCode.getText(callExpr.arguments[1])}).${arrayName}(${sourceCode.getText(
                  callExpr.arguments[0],
                )})`,
              );
            },
          });
        },

      /**
       * Transform `R.map/find(fn, array)` to `array.map/find(fn)`
       */
      [`CallExpression[arguments.length=2] > MemberExpression.callee[object.name="R"]:matches([property.name="map"], [property.name="find"])`]:
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
            messageId: "useArrayMethod",
            data: {
              arrayName: node.property.name,
              ramdaName: node.property.name,
            },
            fix(fixer) {
              return fixer.replaceText(
                callExpr,
                // Add parentheses indiscriminately, leave it to prettier to clean up
                `(${sourceCode.getText(callExpr.arguments[1])}).${
                  node.property.name
                }(${sourceCode.getText(callExpr.arguments[0])})`,
              );
            },
          });
        },
    };
  },
};
