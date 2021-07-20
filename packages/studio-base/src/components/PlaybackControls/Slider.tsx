// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { clamp } from "lodash";
import DocumentEvents from "react-document-events";
import styled from "styled-components";

import sendNotification from "@foxglove/studio-base/util/sendNotification";

type Props = {
  value: number | undefined;
  min: number;
  max: number;
  disabled: boolean;
  step?: number;
  draggable: boolean;
  onChange: (arg0: number) => void;
  renderSlider: (value?: number) => React.ReactNode;
};

const StyledSlider = styled.div<{ disabled?: boolean }>`
  width: 100%;
  height: 100%;
  position: relative;
  cursor: ${({ disabled = false }) => (disabled ? "not-allowed" : "pointer")};
  border-radius: 2px;
`;

export const StyledRange = styled.div.attrs<{ width: number }>(({ width }) => ({
  style: { width: `${width * 100}%` },
}))<{ width: number }>`
  background-color: rgba(255, 255, 255, 0.2);
  position: absolute;
  height: 100%;
  border-radius: 2px;
`;

function defaultRenderSlider(value: number | undefined): React.ReactNode {
  if (value == undefined || isNaN(value)) {
    return ReactNull;
  }
  return <StyledRange width={value} />;
}

export default class Slider extends React.Component<Props> {
  static defaultProps = {
    min: 0,
    draggable: false,
    disabled: false,
    renderSlider: defaultRenderSlider,
  };

  // mouseDown is kept as a variable rather than inside state to avoid problems if mousedown/up are
  // called very quickly before the state update is applied.
  mouseDown: boolean = false;

  el?: HTMLDivElement;

  override shouldComponentUpdate(nextProps: Props): boolean {
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
    // but to appease TypeScript we need to check if the ref is defined
    if (!this.el) {
      console.warn("No dom ref available for click handler");
      return 0;
    }
    const { left, width } = this.el.getBoundingClientRect();
    const { clientX } = e;
    const t = (clientX - left) / width;
    let interpolated = min + t * (max - min);
    if (step != undefined && step !== 0) {
      interpolated = Math.round(interpolated / step) * step;
    }
    return clamp(interpolated, min, max);
  }

  _onClick = (e: React.MouseEvent<HTMLDivElement>): void => {
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
    if (disabled || !draggable || !this.mouseDown) {
      return;
    }
    const value = this.getValueAtMouse(e);
    onChange(value);
  };

  _onMouseDown = (e: React.MouseEvent<HTMLDivElement>): void => {
    const { draggable, onChange, disabled } = this.props;
    if (disabled || !draggable) {
      return;
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    e.preventDefault();
    const value = this.getValueAtMouse(e);
    onChange(value);
    this.mouseDown = true;
    this.forceUpdate();
  };

  override render(): JSX.Element {
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
        {renderSlider(value != undefined && min !== max ? (value - min) / (max - min) : undefined)}
      </StyledSlider>
    );
  }
}
