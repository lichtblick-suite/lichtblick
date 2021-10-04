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

import { Component } from "react";

import { LegacyButton } from "@foxglove/studio-base/components/LegacyStyledComponents";

import LogList, { RenderRow } from "./LogList";

const MSG_BATCH_SIZE = 100;

const sampleText = [
  "Lorem ipsum dolor sit amet.",
  "Lorem ipsum dolor sit amet consectetur, adipisicing elit. Perspiciatis excepturi dolorum molestias odit quidem, eligendi non doloremque consectetur cupiditate tenetur!",
  "Lorem ipsum, dolor sit amet consectetur adipisicing elit. Repellat, vero.",
  "Lorem ipsum dolor sit amet consectetur adipisicing elit. Ut impedit temporibus, corporis quidem quam itaque.",
  "Lorem ipsum dolor sit amet consectetur adipisicing ",
];

const generateData = (size: number) => {
  return Array(size)
    .fill(0)
    .map((_val, idx) => {
      return {
        id: idx,
        text: sampleText[idx % sampleText.length],
      };
    });
};

type Props = {
  renderRow: RenderRow<any>;
};

type State = {
  items: any[];
  paused: boolean;
};

class Example extends Component<Props, State> {
  private _intervalId?: ReturnType<typeof setInterval>;
  override state = { items: generateData(MSG_BATCH_SIZE), paused: true };

  override componentDidMount() {
    if (!this.state.paused) {
      this._startTimer();
    }
  }

  override componentWillUnmount() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
    }
  }

  private _startTimer = () => {
    this._intervalId = setInterval(() => {
      const newData = generateData(MSG_BATCH_SIZE);
      const items = [...this.state.items, ...newData];
      this.setState({ items });
    }, 500);
  };

  togglePause = () => {
    const paused = !this.state.paused;
    if (paused) {
      if (this._intervalId) {
        clearInterval(this._intervalId);
      }
    } else {
      this._startTimer();
    }
    this.setState({ paused });
  };

  override render() {
    const { renderRow } = this.props;
    const { items, paused } = this.state;

    return (
      <div
        style={{
          padding: 20,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <LegacyButton onClick={this.togglePause}>
          {paused ? "Resume Stream" : "Pause Stream"}
        </LegacyButton>
        <LogList items={items} renderRow={renderRow} />
      </div>
    );
  }
}

export default {
  title: "panels/Rosout/LogList",
  component: LogList,
};

export const List = (): JSX.Element => {
  return (
    <Example
      renderRow={({ item, style }) => (
        <div
          style={{
            ...style,
            display: "flex",
            flexDirection: "column",
            padding: 8,
            borderBottom: "1px solid gray",
          }}
          key={item.id}
        >
          <span style={{ color: "orange", marginRight: 8 }}>{item.id}</span> {item.text}
        </div>
      )}
    />
  );
};
