// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/** @type {import("eslint").Rule.RuleModule} */
module.exports = {
  meta: {
    type: "problem",
    hasSuggestions: true,
  },
  create: (context) => {
    return {
      [`JSXElement > JSXOpeningElement > JSXAttribute[name.name="href"]`]: (node) => {
        if (node.parent.attributes.some((attr) => attr.name.name === "target")) {
          return;
        }
        context.report({
          node,
          message: "Links must specify a target",
          suggest: [
            {
              desc: 'Add target="_blank"',
              fix: (fixer) => fixer.insertTextAfter(node, ' target="_blank"'),
            },
            {
              desc: 'Add target="_self" (the default)',
              fix: (fixer) => fixer.insertTextAfter(node, ' target="_self"'),
            },
          ],
        });
      },
    };
  },
};
