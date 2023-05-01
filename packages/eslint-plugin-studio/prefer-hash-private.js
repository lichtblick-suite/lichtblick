// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * @param {import("estree").Node} node
 */
function getEnclosingClass(node) {
  for (let current = node; current; current = current.parent) {
    if (current.type === "ClassDeclaration") {
      return current;
    } else if (current.type === "FunctionDeclaration") {
      return undefined;
    } else if (
      current.type === "FunctionExpression" &&
      current.parent?.parent?.type !== "ClassBody"
    ) {
      return undefined;
    }
  }
}

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    fixable: "code",
    hasSuggestions: true,
  },
  create: (context) => {
    /** @type {Map<import("estree").ClassDeclaration, { privates: Set<import("estree").Identifier>, memberReferences: Map<string, import("estree").Identifier[]> }>} */
    const infoByClass = new Map();
    return {
      [`MemberExpression:has(ThisExpression.object) > Identifier.property`]: (
        /** @type {import("estree").Identifier} */ node,
      ) => {
        if (node.parent.object.type !== "ThisExpression") {
          // Avoid treating `this.foo.bar` as a reference to `private bar`.
          // We'd prefer the selector to use `:has(> ThisExpression.object)`, but ESQuery doesn't support that syntax.
          return;
        }
        const cls = getEnclosingClass(node);
        if (!cls) {
          return;
        }
        let info = infoByClass.get(cls);
        if (!info) {
          info = { privates: new Set(), memberReferences: new Map() };
          infoByClass.set(cls, info);
        }
        let refs = info.memberReferences.get(node.name);
        if (!refs) {
          refs = [];
          info.memberReferences.set(node.name, refs);
        }
        refs.push(node);
      },
      [`:matches(PropertyDefinition, MethodDefinition)[accessibility="private"] > Identifier.key`]:
        (
          /** @type {import("estree").PropertyDefinition | import("estree").MethodDefinition} */
          node,
        ) => {
          const cls = getEnclosingClass(node);
          if (!cls) {
            throw new Error("No class around private definition??");
          }

          let info = infoByClass.get(cls);
          if (!info) {
            info = { privates: new Set(), memberReferences: new Map() };
            infoByClass.set(cls, info);
          }
          info.privates.add(node);
        },

      [`ClassDeclaration:exit`]: (node) => {
        const info = infoByClass.get(node);
        if (!info) {
          return;
        }

        for (const privateIdentifier of info.privates) {
          const refs = info.memberReferences.get(privateIdentifier.name);
          if (!refs) {
            continue;
          }

          const newName = "#" + privateIdentifier.name.replace(/^_/, "");
          context.report({
            node: privateIdentifier,
            message: `Prefer \`${newName}\` language feature over \`private ${privateIdentifier.name}\` accessibility modifier`,
            suggest: [
              {
                desc: `Rename to ${newName}`,
                *fix(fixer) {
                  const privateToken = context
                    .getSourceCode()
                    .getTokens(privateIdentifier.parent)
                    .find((token) => token.type === "Keyword" && token.value === "private");
                  if (privateToken) {
                    yield fixer.removeRange([privateToken.range[0], privateToken.range[1] + 1]);
                  }
                  yield fixer.replaceText(privateIdentifier, newName);
                  for (const ref of refs) {
                    yield fixer.replaceText(ref, newName);
                  }
                },
              },
            ],
          });
        }
      },
    };
  },
};
