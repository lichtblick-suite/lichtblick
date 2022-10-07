// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import getPrettifiedCode from "@foxglove/studio-base/panels/NodePlayground/getPrettifiedCode";
import { NodeData } from "@foxglove/studio-base/players/UserNodePlayer/types";

import { generateTypesLib, generateTypesInterface } from "./generateTypesLib";
import { compile } from "./transform";

const baseNodeData: NodeData = {
  name: "/studio_script/main",
  sourceCode: "",
  transpiledCode: "",
  diagnostics: [],
  inputTopics: [],
  outputTopic: "",
  outputDatatype: "",
  globalVariables: [],
  datatypes: new Map(),
  sourceFile: undefined,
  typeChecker: undefined,
  rosLib: "",
  typesLib: "",
  projectCode: new Map<string, string>(),
};

describe("generateTypesLib", () => {
  describe("generateDatatypesInterface", () => {
    it("should generate basic Datatypes interface", async () => {
      const src = generateTypesInterface(
        new Map(
          Object.entries({
            "std_msgs.ColorRGBA": {
              definitions: [
                { type: "float32", name: "r", isArray: false, isComplex: false },
                { type: "float32", name: "g", isArray: false, isComplex: false },
                { type: "float32", name: "b", isArray: false, isComplex: false },
                { type: "float32", name: "a", isArray: false, isComplex: false },
              ],
            },
          }),
        ),
      );

      const { diagnostics } = compile({ ...baseNodeData, sourceCode: src });
      expect(diagnostics).toEqual([]);

      const prettified = await getPrettifiedCode(src);
      expect(prettified).toMatchSnapshot();
    });
    it("should generate type with backslash", async () => {
      const src = generateTypesInterface(
        new Map(
          Object.entries({
            "std_msgs\\ColorRGBA": {
              definitions: [{ type: "float32", name: "r", isArray: false, isComplex: false }],
            },
          }),
        ),
      );

      const { diagnostics } = compile({ ...baseNodeData, sourceCode: src });
      expect(diagnostics).toEqual([]);

      const prettified = await getPrettifiedCode(src);
      expect(prettified).toMatchSnapshot();
    });
    it("should generate multiple datatypes in Datatypes interface", async () => {
      const src = generateTypesInterface(
        new Map(
          Object.entries({
            "pkg.foo.Bar": {
              definitions: [{ type: "pkg.baz.Car", name: "car", isArray: false, isComplex: true }],
            },
            "pkg.baz.Car": {
              definitions: [{ type: "float32", name: "points", isArray: true, isComplex: false }],
            },
          }),
        ),
      );

      const { diagnostics } = compile({ ...baseNodeData, sourceCode: src });
      expect(diagnostics).toEqual([]);

      const prettified = await getPrettifiedCode(src);
      expect(prettified).toMatchSnapshot();
    });
  });

  it("should generate types lib", async () => {
    const src = generateTypesLib({
      topics: [
        {
          name: "/my_topic",
          schemaName: "std_msgs/ColorRGBA",
        },
      ],
      datatypes: new Map(
        Object.entries({
          "std_msgs/ColorRGBA": {
            definitions: [{ type: "float32", name: "r", isArray: false, isComplex: false }],
          },
        }),
      ),
    });

    const prettified = await getPrettifiedCode(src);

    const { diagnostics } = compile({ ...baseNodeData, sourceCode: src });
    expect(diagnostics).toEqual([]);

    expect(prettified).toMatchSnapshot();
  });

  // A topic may reference a datatype which is not yet known (hasn't been subscribed or won't be)
  // The types library must still compile.
  it("should work when a datatype is not known", async () => {
    const src = generateTypesLib({
      topics: [
        {
          name: "/my_topic",
          schemaName: "std_msgs/ColorRGBA",
        },
        {
          name: "/another_topic",
          schemaName: "unknown_datatype",
        },
      ],
      datatypes: new Map(
        Object.entries({
          "std_msgs/ColorRGBA": {
            definitions: [{ type: "float32", name: "r", isArray: false, isComplex: false }],
          },
        }),
      ),
    });

    const prettified = await getPrettifiedCode(src);

    const { diagnostics } = compile({ ...baseNodeData, sourceCode: src });
    expect(diagnostics).toEqual([]);

    expect(prettified).toMatchSnapshot();
  });
});
