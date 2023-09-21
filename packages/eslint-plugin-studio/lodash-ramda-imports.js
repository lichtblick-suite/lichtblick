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

const configs = [
  {
    convertFrom: "lodash",
    package: "lodash-es",
    preferNamespaceImport: "_",
  },
  {
    package: "ramda",
    preferNamespaceImport: "R",
  },
];

/**
 * Replace `import { x } from "lodash";` with `import * as _ from "lodash-es";` and usage sites with `_.x`.
 * @type {import("eslint").Rule.RuleModule}
 */
module.exports = {
  meta: {
    type: "problem",
    fixable: "code",
    messages: {
      useDifferentPackage: `Use "{{package}}" instead of "{{convertFrom}}"`,
      useNamespaceImport: `Use 'import * as {{name}} from "{{package}}"' instead`,
    },
  },
  create: (context) => {
    return {
      ImportDeclaration: (/** @type {import("estree").ImportDeclaration} */ node) => {
        for (const config of configs) {
          if (config.convertFrom == undefined || node.source.value !== config.convertFrom) {
            continue;
          }
          context.report({
            node,
            messageId: "useDifferentPackage",
            data: { package: config.package, convertFrom: config.convertFrom },
            fix(fixer) {
              return fixer.replaceText(node.source, `"${config.package}"`);
            },
          });
        }
      },

      [`ImportDeclaration:has(ImportSpecifier, ImportDefaultSpecifier)`]: (
        /** @type {import("estree").ImportDeclaration} */ node,
      ) => {
        for (const config of configs) {
          if (node.source.value !== config.package) {
            continue;
          }
          context.report({
            node,
            messageId: "useNamespaceImport",
            data: { package: config.package, name: config.preferNamespaceImport },
            *fix(fixer) {
              const variables = context.getDeclaredVariables(node);
              const defaultImportName = node.specifiers.find(
                (specifier) => specifier.type === "ImportDefaultSpecifier",
              )?.local.name;
              for (const variable of variables) {
                for (const reference of variable.references) {
                  if (variable.name === defaultImportName) {
                    yield fixer.replaceText(reference.identifier, config.preferNamespaceImport);
                  } else {
                    yield fixer.replaceText(
                      reference.identifier,
                      `${config.preferNamespaceImport}.${getImportedName(variable)}`,
                    );
                  }
                }
              }
              yield fixer.replaceText(
                node,
                `import * as ${config.preferNamespaceImport} from "${config.package}";`,
              );
            },
          });
        }
      },
    };
  },
};
