// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Support renamed imports, e.g. return `"get"` for `import { get as lodashGet } from "lodash";`.
 * @param {import("eslint").Scope.Variable} variable
 */
function getImportedName(variable) {
  for (const def of variable.defs) {
    if (def.type === "ImportBinding" && def.node.type === "ImportSpecifier") {
      return def.node.imported.name;
    }
  }
  return variable.name;
}

/**
 * Replace `import { x } from "lodash";` with `import * as _ from "lodash-es";` and usage sites with `_.x`.
 * @type {import("eslint").Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: "problem",
    fixable: "code",
    messages: {
      useLodashEs: `Use "lodash-es" instead of "lodash"`,
      useNamespaceImport: `Use 'import * as _ from "lodash-es"' instead`,
    },
  },
  create: (context) => {
    return {
      [`ImportDeclaration[source.value="lodash"]`]: (
        /** @type {import("estree").ImportDeclaration} */ node,
      ) => {
        context.report({
          node,
          messageId: "useLodashEs",
          fix(fixer) {
            return fixer.replaceText(node.source, '"lodash-es"');
          },
        });
      },

      [`ImportDeclaration[source.value="lodash-es"]:has(ImportSpecifier, ImportDefaultSpecifier)`]:
        (/** @type {import("estree").ImportDeclaration} */ node) => {
          context.report({
            node,
            messageId: "useNamespaceImport",
            *fix(fixer) {
              const variables = context.getDeclaredVariables(node);
              const defaultImportName = node.specifiers.find(
                (specifier) => specifier.type === "ImportDefaultSpecifier",
              )?.local.name;
              for (const variable of variables) {
                for (const reference of variable.references) {
                  if (variable.name === defaultImportName) {
                    yield fixer.replaceText(reference.identifier, "_");
                  } else {
                    yield fixer.replaceText(reference.identifier, `_.${getImportedName(variable)}`);
                  }
                }
              }
              yield fixer.replaceText(node, `import * as _ from "lodash-es";`);
            },
          });
        },
    };
  },
};
