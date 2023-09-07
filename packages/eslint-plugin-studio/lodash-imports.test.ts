// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RuleTester } from "@typescript-eslint/rule-tester";
import { TSESLint } from "@typescript-eslint/utils";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rule = require("./lodash-imports") as TSESLint.RuleModule<
  "useLodashEs" | "useNamespaceImport"
>;

const ruleTester = new RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    tsconfigRootDir: path.join(__dirname, "fixture"),
    project: "tsconfig.json",
  },
});

ruleTester.run("lodash-imports", rule, {
  valid: [
    `
    import * as _ from "lodash-es";
    _.isEqual(1, 1);
    `,
  ],

  invalid: [
    {
      code: /* ts */ `
        import * as _ from "lodash";
        _.isEqual(1, 1);
      `,
      errors: [{ messageId: "useLodashEs" }],
      output: /* ts */ `
        import * as _ from "lodash-es";
        _.isEqual(1, 1);
      `,
    },

    {
      code: /* ts */ `
        import _ from "lodash-es";
        _.isEqual(1, 1);
      `,
      errors: [{ messageId: "useNamespaceImport" }],
      output: /* ts */ `
        import * as _ from "lodash-es";
        _.isEqual(1, 1);
      `,
    },

    {
      code: /* ts */ `
        import _, { isEmpty } from "lodash-es";
        _.isEqual(1, 1);
        isEmpty({});
      `,
      errors: [{ messageId: "useNamespaceImport" }],
      output: /* ts */ `
        import * as _ from "lodash-es";
        _.isEqual(1, 1);
        _.isEmpty({});
      `,
    },

    {
      code: /* ts */ `
        import lodash, { isEmpty as lodashIsEmpty } from "lodash-es";
        lodash.isEqual(1, 1);
        lodashIsEmpty({});
      `,
      errors: [{ messageId: "useNamespaceImport" }],
      output: /* ts */ `
        import * as _ from "lodash-es";
        _.isEqual(1, 1);
        _.isEmpty({});
      `,
    },
  ],
});
