// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { uniq } from "lodash";
import { Worldview } from "regl-worldview";

import Flex from "@foxglove/studio-base/components/Flex";
import PanelLayout from "@foxglove/studio-base/components/PanelLayout";
import GlobalVariableSliderPanel from "@foxglove/studio-base/panels/GlobalVariableSlider";
import ThreeDimensionalViz from "@foxglove/studio-base/panels/ThreeDimensionalViz";
import { ThreeDimensionalVizConfig } from "@foxglove/studio-base/panels/ThreeDimensionalViz/types";
import { Frame, Topic } from "@foxglove/studio-base/players/types";
import createRootReducer from "@foxglove/studio-base/reducers";
import configureStore from "@foxglove/studio-base/store/configureStore";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";
import PanelSetupWithBag from "@foxglove/studio-base/stories/PanelSetupWithBag";
import inScreenshotTests from "@foxglove/studio-base/stories/inScreenshotTests";
import { ScreenshotSizedContainer } from "@foxglove/studio-base/stories/storyHelpers";
import { getPanelIdForType } from "@foxglove/studio-base/util/layout";

type Store = ReturnType<typeof configureStore>;

export type FixtureExampleData = {
  topics: {
    [topicName: string]: Topic;
  };
  frame: Frame;
  globalVariables?: {
    [name: string]: string | number;
  };
};

type FixtureExampleProps = {
  initialConfig: Partial<ThreeDimensionalVizConfig>;
  data?: FixtureExampleData;
  loadData?: Promise<FixtureExampleData>;
  futureTime?: boolean;
  onMount?: (arg0: HTMLDivElement | undefined, store?: Store) => void;
};

type FixtureExampleState = {
  fixture?: Fixture;
  config: Partial<ThreeDimensionalVizConfig>;
  panelId: string;
};

export const WorldviewContainer = (props: { children: React.ReactNode }): JSX.Element => {
  return (
    <Worldview {...props} hideDebug={inScreenshotTests()}>
      {props.children}
    </Worldview>
  );
};

export class FixtureExample extends React.Component<FixtureExampleProps, FixtureExampleState> {
  state: FixtureExampleState = {
    fixture: undefined,
    config: this.props.initialConfig,
    panelId: getPanelIdForType(ThreeDimensionalViz.panelType),
  };

  componentDidMount(): void {
    const { data, loadData } = this.props;
    if (data) {
      this.updateState(data);
    }
    if (loadData) {
      loadData.then((loadedData) => {
        this.updateState(loadedData);
      });
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps: FixtureExampleProps): void {
    if (nextProps.data) {
      this.updateState(nextProps.data);
    }
  }

  updateState = (data: FixtureExampleData): void => {
    const { topics, globalVariables } = data;
    this.setState(
      {
        fixture: {
          topics: Object.values(topics),
          globalVariables: globalVariables ?? { futureTime: 1.5 },
          frame: {},
          savedProps: {
            [this.state.panelId]: this.props.initialConfig,
          },
        },
      }, // Delay passing in the frame in order to work around a MessageHistory behavior
      // where the existing frame is not re-processed when the set of topics changes.
      () => {
        // Additional delay to allow the 3D panel's dynamic setSubscriptions to take effect
        // *before* the fixture changes, not in the same update cycle.
        setImmediate(() => {
          this.setState((state) => ({
            fixture: { ...(state.fixture as Fixture), frame: data.frame },
          }));
          // Additional delay to trigger updating available namespaces after consuming
          // the messages in SceneBuilder.
          setImmediate(() => {
            this.setState({});
          });
        });
      },
    );
  };

  render(): JSX.Element | ReactNull {
    const { fixture } = this.state;
    if (!fixture) {
      return ReactNull;
    }
    return (
      <PanelSetup fixture={fixture} onMount={this.props.onMount}>
        <Flex col>
          <ThreeDimensionalViz childId={this.state.panelId} />
          {this.props.futureTime != undefined && (
            <div style={{ height: "100px" }}>
              <GlobalVariableSliderPanel
                overrideConfig={{
                  sliderProps: { min: 0, max: 12, step: 0.5 },
                  globalVariableName: "futureTime",
                }}
              />
            </div>
          )}
        </Flex>
      </PanelSetup>
    );
  }
}

export const ThreeDimPanelSetupWithBag = ({
  threeDimensionalConfig,
  globalVariables = {},
  bag,
}: {
  threeDimensionalConfig: Partial<ThreeDimensionalVizConfig>;
  globalVariables: any;
  bag: string;
}): JSX.Element => {
  const store: Store = configureStore(createRootReducer());
  const topics = uniq(
    threeDimensionalConfig.checkedKeys
      ?.filter((key) => key.startsWith("t:"))
      .map((topic) => topic.substring(2)),
  );

  return (
    <ScreenshotSizedContainer>
      <PanelSetupWithBag
        frameHistoryCompatibility
        bag={bag}
        subscriptions={topics}
        store={store}
        onMount={(_el, _store, _layoutActions, selectedPanelActions) => {
          // Wait for the panel to finish resizing
          setTimeout(() => {
            // Select the panel so we can control with the keyboard
            selectedPanelActions.selectAllPanels();
          }, 500);
        }}
        getMergedFixture={(bagFixture: any) => ({
          ...bagFixture,
          globalVariables: { ...globalVariables },
          layout: {
            first: "3D Panel!a",
            second: "GlobalVariableSliderPanel!b",
            direction: "column",
            splitPercentage: 92.7860696517413,
          },
          savedProps: {
            "3D Panel!a": threeDimensionalConfig,
            "GlobalVariableSliderPanel!b": {
              sliderProps: {
                min: 0,
                max: 12,
                step: 0.5,
              },
              globalVariableName: "futureTime",
            },
          },
        })}
      >
        <PanelLayout />
      </PanelSetupWithBag>
    </ScreenshotSizedContainer>
  );
};
