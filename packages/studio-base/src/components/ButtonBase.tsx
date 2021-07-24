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

import cx from "classnames";
import { CSSProperties } from "react";

import { LegacyButton } from "@foxglove/studio-base/components/LegacyStyledComponents";

export type Props = {
  id?: string;
  small?: boolean;
  large?: boolean;
  primary?: boolean;
  warning?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick?: (event: React.SyntheticEvent<HTMLButtonElement>) => void;
  onFocus?: (event: React.SyntheticEvent<HTMLButtonElement>) => void;
  onMouseUp?: (event: React.SyntheticEvent<HTMLButtonElement>) => void;
  onMouseLeave?: (event: React.SyntheticEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  tooltip?: string;
  innerRef?: React.Ref<HTMLButtonElement>;
};

class ButtonBaseImpl extends React.Component<Props> {
  animationId?: ReturnType<typeof requestAnimationFrame>;
  cancelTimeoutId?: ReturnType<typeof setTimeout>;

  override componentWillUnmount() {
    if (this.animationId != undefined) {
      cancelAnimationFrame(this.animationId);
    }
    if (this.cancelTimeoutId) {
      clearTimeout(this.cancelTimeoutId);
    }
  }

  onMouseUp = (e: React.SyntheticEvent<HTMLButtonElement>) => {
    const { onMouseUp } = this.props;
    this.cancelDown();
    if (onMouseUp) {
      onMouseUp(e);
    }
  };

  onMouseLeave = (e: React.SyntheticEvent<HTMLButtonElement>) => {
    const { onMouseLeave } = this.props;
    this.cancelDown();
    if (onMouseLeave) {
      onMouseLeave(e);
    }
  };

  onClick = (e: React.SyntheticEvent<HTMLButtonElement>) => {
    const { onClick } = this.props;
    e.stopPropagation();
    e.preventDefault();
    if (onClick) {
      onClick(e);
    }
  };

  cancelDown = () => {
    this.setState({ mouseDown: false });
  };

  override render() {
    const {
      children,
      id,
      small,
      large,
      primary,
      danger,
      warning,
      disabled,
      className,
      style,
      tooltip,
      onFocus,
      innerRef,
    } = this.props;
    const classes = cx("button", className ?? "", {
      // support some bulma classes to be supplied in consumer either through bulma or custom classes
      // these provide backwards compatibility with Studio
      "is-small": small,
      "is-large": large,
      "is-primary": primary,
      "is-warning": warning,
      "is-danger": danger,
    });

    return (
      <LegacyButton
        type="button"
        className={classes}
        id={id}
        onClick={this.onClick}
        onFocus={onFocus}
        onMouseLeave={this.onMouseLeave}
        onMouseUp={this.onMouseUp}
        style={{ position: "relative", ...style }}
        title={tooltip}
        disabled={disabled}
        ref={innerRef}
      >
        {children}
      </LegacyButton>
    );
  }
}
export default React.forwardRef<HTMLButtonElement, Props>(function ButtonBase(props, ref) {
  return <ButtonBaseImpl {...props} innerRef={ref} />;
});
