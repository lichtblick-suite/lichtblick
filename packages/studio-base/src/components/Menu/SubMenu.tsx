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

import ChildToggle from "@foxglove/studio-base/components/ChildToggle";

import Item from "./Item";
import Menu from "./Menu";

type State = {
  open: boolean;
};

type Props = {
  children: React.ReactNode;
  text: React.ReactNode;
  checked?: boolean;
  direction: "left" | "right";
  icon?: React.ReactNode;
  style?: React.CSSProperties;
  dataTest?: string;
};

export default class SubMenu extends React.Component<Props, State> {
  private _unmounted: boolean = false;

  override state = {
    open: false,
  };

  static defaultProps = {
    checked: false,
    direction: "right",
  };

  toggle = (): void => {
    if (this._unmounted) {
      return;
    }
    this.setState(({ open }) => ({ open: !open }));
  };

  override componentWillUnmount(): void {
    // the submenu might unmount on click, so don't update state if its gone
    this._unmounted = true;
  }

  override render(): JSX.Element {
    const { text, children, checked, direction, icon, dataTest, style } = this.props;
    const { open } = this.state;
    return (
      <ChildToggle
        noPortal
        position={direction === "left" ? "left" : "right"}
        onToggle={this.toggle}
        isOpen={open}
        style={style}
        dataTest={dataTest}
      >
        <Item hasSubMenu direction={direction} checked={open || checked} icon={icon}>
          {text}
        </Item>
        <Menu>{children}</Menu>
      </ChildToggle>
    );
  }
}
