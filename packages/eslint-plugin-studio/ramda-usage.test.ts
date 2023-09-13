// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { RuleTester } from "@typescript-eslint/rule-tester";
import { TSESLint } from "@typescript-eslint/utils";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rule = require("./ramda-usage") as TSESLint.RuleModule<"useMath" | "useArrayMap">;

const ruleTester = new RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2020,
    tsconfigRootDir: path.join(__dirname, "fixture"),
    project: "tsconfig.json",
  },
});

ruleTester.run("ramda-usage", rule, {
  valid: [
    /* ts */ `
    import * as R from "ramda";
    R.max(1)(2);
    R.max;
    R.map((x) => x + 1);
    R.map((x) => x + 1, {a: 1, b: 2});
    `,
  ],

  invalid: [
    {
      code: /* ts */ `
        import * as R from "ramda";
        R.min(1, 2);
        R.max(1, 2);
      `,
      errors: [
        { messageId: "useMath", data: { name: "min" }, line: 3 },
        { messageId: "useMath", data: { name: "max" }, line: 4 },
      ],
      output: /* ts */ `
        import * as R from "ramda";
        Math.min(1, 2);
        Math.max(1, 2);
      `,
    },

    {
      code: /* ts */ `
        import * as R from "ramda";
        R.map((x) => x + 1, [1, 2]);
        R.map((x) => x + 1, [1, 2].reverse(/*hi*/));
        R.map((x) => x + 1, [1] as const);
        foo("bar", R.map((x) => x + 1, [1]));
      `,
      errors: [
        { messageId: "useArrayMap", line: 3 },
        { messageId: "useArrayMap", line: 4 },
        { messageId: "useArrayMap", line: 5 },
        { messageId: "useArrayMap", line: 6 },
      ],
      output: /* ts */ `
        import * as R from "ramda";
        ([1, 2]).map((x) => x + 1);
        ([1, 2].reverse(/*hi*/)).map((x) => x + 1);
        ([1] as const).map((x) => x + 1);
        foo("bar", ([1]).map((x) => x + 1));
      `,
    },
  ],
});
