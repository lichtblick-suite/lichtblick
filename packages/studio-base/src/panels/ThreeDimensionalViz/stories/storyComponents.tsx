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

import Flex from "@foxglove/studio-base/components/Flex";
import GlobalVariableSliderPanel from "@foxglove/studio-base/panels/GlobalVariableSlider";
import ThreeDimensionalViz from "@foxglove/studio-base/panels/ThreeDimensionalViz";
import { ThreeDimensionalVizConfig } from "@foxglove/studio-base/panels/ThreeDimensionalViz/types";
import { Frame, Topic } from "@foxglove/studio-base/players/types";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";
import { getPanelIdForType } from "@foxglove/studio-base/util/layout";

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
  onMount?: (arg0: HTMLDivElement | undefined) => void;
};

type FixtureExampleState = {
  fixture?: Fixture;
  config: Partial<ThreeDimensionalVizConfig>;
  panelId: string;
};

export class FixtureExample extends React.Component<FixtureExampleProps, FixtureExampleState> {
  override state: FixtureExampleState = {
    fixture: undefined,
    config: this.props.initialConfig,
    panelId: getPanelIdForType(ThreeDimensionalViz.panelType),
  };

  override componentDidMount(): void {
    const { data, loadData } = this.props;
    if (data) {
      this.updateState(data);
    }
    if (loadData) {
      void loadData.then((loadedData) => {
        this.updateState(loadedData);
      });
    }
  }

  override UNSAFE_componentWillReceiveProps(nextProps: FixtureExampleProps): void {
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

  override render(): JSX.Element | ReactNull {
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
