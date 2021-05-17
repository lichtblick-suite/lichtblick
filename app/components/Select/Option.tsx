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

import Icon from "@foxglove/studio-base/components/Icon";

import styles from "./Option.module.scss";

type Props = {
  // value is used by the Select component
  value?: any; // eslint-disable-line
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  disabled: boolean;
  active: boolean;
  rightIcon?: React.ReactNode;
};

export default class Option extends React.Component<Props> {
  static defaultProps = {
    disabled: false,
    active: false,
  };

  renderRightIcon(): React.ReactNode {
    const { rightIcon } = this.props;
    if (rightIcon == undefined) {
      return;
    }
    return (
      <span style={{ float: "right" }}>
        <Icon>{rightIcon}</Icon>
      </span>
    );
  }

  render(): JSX.Element {
    const { onClick, active, disabled, children } = this.props;
    const className = cx(styles.container, {
      [styles.active!]: active,
      [styles.disabled!]: disabled,
    });
    return (
      <div className={className} onClick={onClick}>
        {children}
        {this.renderRightIcon()}
      </div>
    );
  }
}
