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

import Menu from "@foxglove-studio/app/components/Menu";
import Tooltip from "@foxglove-studio/app/components/TooltipBase";

type Props = {
  children: React.ReactNode;
};

// a tiny wrapper around the tooltip component that automatically
// hides on the next mouse click so you don't have to manage window listeners yourself
export default class ContextMenu extends React.Component<Props> {
  static show(x: number, y: number, contents: React.ReactNode) {
    Tooltip.show(x, y, <ContextMenu>{contents}</ContextMenu>);
  }

  componentDidMount() {
    window.addEventListener("click", this.hide);
  }

  hide = () => {
    window.removeEventListener("click", this.hide);
    Tooltip.hide();
  };

  render() {
    return <Menu>{this.props.children}</Menu>;
  }
}
