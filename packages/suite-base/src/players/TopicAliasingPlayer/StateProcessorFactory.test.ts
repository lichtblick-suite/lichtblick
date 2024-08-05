// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AliasingStateProcessor } from "./AliasingStateProcessor";
import { NoopStateProcessor } from "./NoopStateProcessor";
import { StateProcessorFactory } from "./StateProcessorFactory";

describe("StateProcessorFactory", () => {
  it("builds a noop state processor when there are no aliases", () => {
    const factory = new StateProcessorFactory();
    const processor = factory.buildStateProcessor({
      aliasFunctions: [],
      topics: [],
      variables: {},
    });
    expect(processor).toBeInstanceOf(NoopStateProcessor);
  });

  it("builds processor when there are aliases", () => {
    const factory = new StateProcessorFactory();
    const processor = factory.buildStateProcessor({
      aliasFunctions: [
        {
          extensionId: "id0",
          aliasFunction: () => [{ sourceTopicName: "/foo", name: "/bar" }],
        },
      ],
      topics: [{ name: "/foo", schemaName: "schema" }],
      variables: {},
    });
    expect(processor).toBeInstanceOf(AliasingStateProcessor);
  });

  it("builds keeps the same processor when aliases are the same", () => {
    const factory = new StateProcessorFactory();
    const processor = factory.buildStateProcessor({
      aliasFunctions: [
        {
          extensionId: "id0",
          aliasFunction: () => [{ sourceTopicName: "/foo", name: "/bar" }],
        },
      ],
      topics: [{ name: "/foo", schemaName: "schema" }],
      variables: {},
    });
    expect(processor).toBeInstanceOf(AliasingStateProcessor);

    const processor2 = factory.buildStateProcessor({
      aliasFunctions: [
        {
          extensionId: "id0",
          aliasFunction: () => [{ sourceTopicName: "/foo", name: "/bar" }],
        },
      ],
      topics: [{ name: "/foo", schemaName: "schema" }],
      variables: {},
    });
    expect(processor2).toBe(processor);
  });

  it("builds a new processor when aliases change", () => {
    const factory = new StateProcessorFactory();
    const processor = factory.buildStateProcessor({
      aliasFunctions: [
        {
          extensionId: "id0",
          aliasFunction: () => [{ sourceTopicName: "/foo", name: "/bar" }],
        },
      ],
      topics: [{ name: "/foo", schemaName: "schema" }],
      variables: {},
    });
    expect(processor).toBeInstanceOf(AliasingStateProcessor);

    const processor2 = factory.buildStateProcessor({
      aliasFunctions: [
        {
          extensionId: "id0",
          aliasFunction: () => [{ sourceTopicName: "/foo", name: "/another" }],
        },
      ],
      topics: [{ name: "/foo", schemaName: "schema" }],
      variables: {},
    });
    expect(processor2).toBeInstanceOf(AliasingStateProcessor);
    expect(processor2).not.toBe(processor);
  });

  it("should provide global variables to alias functions", () => {
    expect.assertions(2);

    const factory = new StateProcessorFactory();
    const processor = factory.buildStateProcessor({
      aliasFunctions: [
        {
          extensionId: "id0",
          aliasFunction: (args) => {
            expect(args.globalVariables).toEqual({ someVariable: "name" });
            return [{ sourceTopicName: "/foo", name: args.globalVariables.someVariable as string }];
          },
        },
      ],
      topics: [{ name: "/foo", schemaName: "schema" }],
      variables: {
        someVariable: "name",
      },
    });
    expect(processor).toBeInstanceOf(AliasingStateProcessor);
  });
});
