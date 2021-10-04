/** @jest-environment jsdom */
// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { mount } from "enzyme";
import { omit } from "lodash";

import MockMessagePipelineProvider from "@foxglove/studio-base/components/MessagePipeline/MockMessagePipelineProvider";
import { TRANSFORM_TOPIC } from "@foxglove/studio-base/panels/ThreeDimensionalViz/constants";
import { Namespace } from "@foxglove/studio-base/types/Messages";

import { UseSceneBuilderAndTransformsDataInput } from "./types";
import useSceneBuilderAndTransformsData from "./useSceneBuilderAndTransformsData";

type ErrorsByTopic = {
  [topicName: string]: string[];
};
class MockTransform {
  private _values: { id: string }[];
  constructor({ tfs }: { tfs: { id: string }[] }) {
    this._values = tfs;
  }
  values() {
    return this._values;
  }
}

const DEFAULT_ERRORS = {
  "/topic_a": ["missing transforms to root transform: some_root_tf"],
};

class MockSceneBuilder {
  allNamespaces: Namespace[] = [];
  errorsByTopic: ErrorsByTopic = DEFAULT_ERRORS;
  constructor({
    namespaces,
    errorsByTopic,
  }: {
    namespaces?: Namespace[];
    errorsByTopic?: ErrorsByTopic;
  }) {
    if (namespaces) {
      this.allNamespaces = namespaces;
    }
    if (errorsByTopic) {
      this.errorsByTopic = errorsByTopic;
    }
  }
}

function getMockProps({
  showNamespaces = false,
  showTransforms = false,
  showErrors = false,
  mockTfIds,
}: {
  showNamespaces?: boolean;
  showTransforms?: boolean;
  showErrors?: boolean;
  mockTfIds?: string[];
}): UseSceneBuilderAndTransformsDataInput {
  let tfIds: string[] = [];
  if (showTransforms) {
    tfIds = ["some_tf1", "some_tf2", ""];
  } else if (mockTfIds) {
    tfIds = mockTfIds;
  }

  return {
    sceneBuilder: new MockSceneBuilder({
      namespaces: showNamespaces
        ? [
            { topic: "/foo", name: "ns1" },
            { topic: "/foo", name: "ns2" },
          ]
        : [],
      errorsByTopic: showErrors ? DEFAULT_ERRORS : undefined,
    }),
    transforms: new MockTransform({ tfs: tfIds.map((id) => ({ id })) }),
    staticallyAvailableNamespacesByTopic: {},
  };
}

describe("useSceneBuilderAndTransformsData", () => {
  // Create a helper component that exposes the results of the hook for mocking.
  function createTest() {
    function Test(
      props: UseSceneBuilderAndTransformsDataInput & {
        messagePipelineProps?: React.ComponentProps<typeof MockMessagePipelineProvider>;
      },
    ) {
      return (
        <MockMessagePipelineProvider {...props.messagePipelineProps}>
          <TestInner {...omit(props, "messagePipelineProps")} />
        </MockMessagePipelineProvider>
      );
    }
    function TestInner(props: UseSceneBuilderAndTransformsDataInput) {
      Test.result(useSceneBuilderAndTransformsData(props));
      return ReactNull;
    }
    Test.result = jest.fn();
    return Test;
  }

  describe("availableNamespacesByTopic", () => {
    it("collects namespaces from transforms and sceneBuilder namespaces", () => {
      const Test = createTest();
      const staticallyAvailableNamespacesByTopic = { "/bar": ["ns3", "ns4"] };
      const root = mount(
        <Test
          {...getMockProps({})}
          staticallyAvailableNamespacesByTopic={staticallyAvailableNamespacesByTopic}
        />,
      );
      root.setProps({
        ...getMockProps({ showNamespaces: true, showTransforms: true }),
        staticallyAvailableNamespacesByTopic,
      });

      expect(Test.result.mock.calls.map((args) => args[0].availableNamespacesByTopic)).toEqual([
        staticallyAvailableNamespacesByTopic,
        {
          "/foo": ["ns1", "ns2"],
          [TRANSFORM_TOPIC]: ["some_tf1", "some_tf2"],
          ...staticallyAvailableNamespacesByTopic,
        },
      ]);
    });

    it("shows all transform namespaces collected over time", () => {
      const Test = createTest();
      const root = mount(<Test {...getMockProps({ showTransforms: true })} />);
      expect(Test.result).toHaveBeenCalledTimes(1);
      // TFs were removed, but we still report them in the available namespaces.
      root.setProps(getMockProps({}));
      expect(Test.result).toHaveBeenCalledTimes(2);

      root.setProps(getMockProps({ mockTfIds: ["some_tf3"] }));
      expect(Test.result).toHaveBeenCalledTimes(3);

      // Technically we would only want the Test component to re-render once per props change.
      // However, this test is set up such that the MockTransforms object is replaced on each change.
      // In real-world use, the Transforms object is mutated and only changes when data is cleared out.
      expect(Test.result.mock.calls.map((args) => args[0].availableNamespacesByTopic)).toEqual([
        { [TRANSFORM_TOPIC]: ["some_tf1", "some_tf2"] },
        { [TRANSFORM_TOPIC]: ["some_tf1", "some_tf2"] },
        { [TRANSFORM_TOPIC]: ["some_tf1", "some_tf2", "some_tf3"] },
      ]);
    });

    it("resets transforms collected when the player changes", () => {
      const Test = createTest();
      const root = mount(<Test {...getMockProps({ showTransforms: true })} />);
      root.setProps({ ...getMockProps({}), messagePipelineProps: { playerId: "somePlayerId" } });
      expect(Test.result.mock.calls.map((args) => args[0].availableNamespacesByTopic)).toEqual([
        { [TRANSFORM_TOPIC]: ["some_tf1", "some_tf2"] },
        {},
      ]);
    });
  });

  describe("getSceneErrorsByKey", () => {
    it("collects scene builder errors and group them by key", () => {
      const Test = createTest();
      const mockSceneBuilder = new MockSceneBuilder({
        namespaces: [],
        errorsByTopic: {
          "/topic_a": ["error msg foo", "missing transforms to root transform: some_root_tf"],
          "/studio_bag_2/topic_a": ["error msg bar", "missing frame id"],
        },
      });
      const root = mount(<Test {...getMockProps({})} sceneBuilder={mockSceneBuilder} />);

      expect(Test.result.mock.calls[0][0].sceneErrorsByKey).toEqual({
        "t:/topic_a": ["error msg foo", "missing transforms to root transform: some_root_tf"],
        "t:/studio_bag_2/topic_a": ["error msg bar", "missing frame id"],
      });

      // Update scene errors.
      root.setProps(getMockProps({ showErrors: true }));
      expect(Test.result.mock.calls[1][0].sceneErrorsByKey).toEqual({
        "t:/topic_a": ["missing transforms to root transform: some_root_tf"],
      });
    });
  });
});
