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

import { clamp } from "lodash";
import * as React from "react";
import DocumentEvents from "react-document-events";
import styled from "styled-components";

import sendNotification from "@foxglove-studio/app/util/sendNotification";

// A low level slider component.
//
// Props:
// | Name          | Type                   | Description                                                                    |
// | ------------- | ---------------------- | ------------------------------------------------------------------------------ |
// | onChange      | (number) => void       | callback called whenever the value changes, either after click or during drag. |
// | value         | number                 | the current value of the slider                                                |
// | min           | number                 | the minimum value of the slider                                                |
// | max           | number                 | the maximum value of the slider                                                |
// | draggable?    | boolean                | set to true the slider will fire onChange callbacks during mouse dragging      |
// | renderSlider? | (value:?number) => void | custom renderer to render the slider                                           |

type Props = {
  value: number | undefined;
  min: number;
  max: number;
  disabled?: boolean; // Disable the mouse interactions.
  step?: number;
  draggable?: boolean;
  onChange: (arg0: number) => void;
  renderSlider: (value?: number) => React.ReactNode;
};

const StyledSlider = styled.div<{ disabled?: boolean }>`
  width: 100%;
  height: 100%;
  position: relative;
  cursor: ${({ disabled }) => (disabled ? "not-allowed" : "pointer")};
  border-radius: 2px;
`;

export const StyledRange = styled.div.attrs<{ width: number }>(({ width }) => ({
  style: { width: `${(width || 0) * 100}%` },
}))<{ width: number }>`
  background-color: rgba(255, 255, 255, 0.2);
  position: absolute;
  height: 100%;
  border-radius: 2px;
`;

function defaultRenderSlider(value: number | undefined): React.ReactNode {
  if (value == null || isNaN(value)) {
    return null;
  }
  return <StyledRange width={value} />;
}

export default class Slider extends React.Component<Props> {
  static defaultProps = {
    min: 0,
    draggable: false,
    renderSlider: defaultRenderSlider,
  };

  // mouseDown is kept as a variable rather than inside state to avoid problems if mousedown/up are
  // called very quickly before the state update is applied.
  mouseDown: boolean = false;

  el?: HTMLDivElement;

  shouldComponentUpdate(nextProps: Props) {
    const { value, min, max, draggable } = this.props;
    return (
      nextProps.value !== value ||
      nextProps.min !== min ||
      nextProps.max !== max ||
      nextProps.draggable !== draggable
    );
  }

  getValueAtMouse(e: React.MouseEvent<HTMLDivElement>): number {
    const { min, max, step } = this.props;
    // this should never happen since you can't interact with an unmounted component
    // but to appease flow we need to check if the ref is null
    if (!this.el) {
      console.warn("No dom ref available for click handler");
      return 0;
    }
    const { left, width } = this.el.getBoundingClientRect();
    const { clientX } = e;
    const t = (clientX - left) / width;
    let interpolated = min + t * (max - min);
    if (step) {
      interpolated = Math.round(interpolated / step) * step;
    }
    return clamp(interpolated, min, max);
  }

  _onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const { draggable, onChange, disabled } = this.props;
    if (disabled) {
      return;
    }
    // handled in mouse up/out if draggable
    if (draggable) {
      return;
    }
    const value = this.getValueAtMouse(e);
    onChange(value);
  };

  _onMouseUp = (): void => {
    this.mouseDown = false;
    this.forceUpdate();
  };

  _onMouseMove = (e: React.MouseEvent<HTMLDivElement>): void => {
    const { draggable, onChange, disabled } = this.props;
    if (disabled) {
      return;
    }
    const { mouseDown } = this;
    if (!draggable || !mouseDown) {
      return;
    }
    const value = this.getValueAtMouse(e);
    onChange(value);
  };

  _onMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    const { draggable, onChange, disabled } = this.props;
    if (disabled) {
      return;
    }
    if (!draggable) {
      return;
    }
    if (document.activeElement) {
      (document.activeElement as any).blur();
    }
    e.preventDefault();
    const value = this.getValueAtMouse(e);
    onChange(value);
    this.mouseDown = true;
    this.forceUpdate();
  };

  render() {
    const { min, max, value, renderSlider, draggable, disabled } = this.props;
    const { mouseDown } = this;

    if (max < min) {
      const msg = `Slider component given invalid range: ${min}, ${max}`;
      const err = new Error(msg);
      sendNotification(err.message, err, "app", "error");
    }

    return (
      <StyledSlider
        disabled={disabled}
        ref={(el) => (this.el = el ?? undefined)}
        onClick={this._onClick}
        onMouseDown={this._onMouseDown}
      >
        <DocumentEvents
          target={window}
          enabled={mouseDown && draggable}
          onMouseUp={this._onMouseUp}
          onMouseMove={this._onMouseMove}
        />
        <DocumentEvents
          target={window}
          enabled={mouseDown && draggable}
          onMouseUp={this._onMouseUp}
        />
        {renderSlider(value != null && min !== max ? (value - min) / (max - min) : undefined)}
      </StyledSlider>
    );
  }
}
