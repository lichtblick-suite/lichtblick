// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2019-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.
import * as React from "react";

type KeyHandlers = {
  [key: string]: (event: KeyboardEvent) => void;
};

type Props = {
  global: true | false;
  keyDownHandlers?: KeyHandlers;
  keyPressHandlers?: KeyHandlers;
  keyUpHandlers?: KeyHandlers;
};

export default class KeyListener extends React.Component<Props> {
  el?: HTMLDivElement;

  static defaultProps = {
    global: false,
  };

  componentDidMount() {
    const { global } = this.props;
    const target = global ? document : (this.el || {}).parentElement;
    if (target) {
      target.addEventListener("keydown", this.handleEvent as any);
      target.addEventListener("keypress", this.handleEvent as any);
      target.addEventListener("keyup", this.handleEvent as any);
    }
  }

  componentWillUnmount() {
    const { global } = this.props;
    const target = global ? document : (this.el || {}).parentElement;
    if (target) {
      target.removeEventListener("keydown", this.handleEvent as any);
      target.removeEventListener("keypress", this.handleEvent as any);
      target.removeEventListener("keyup", this.handleEvent as any);
    }
  }

  callHandlers(handlers: KeyHandlers | undefined, event: KeyboardEvent) {
    if (!handlers) {
      return;
    }
    if (typeof handlers[event.key] === "function") {
      event.preventDefault();
      handlers[event.key](event);
    }
  }

  handleEvent = (event: KeyboardEvent) => {
    const { target, type } = event;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    ) {
      // The user is typing in an editable field; ignore the event.
      return;
    }

    switch (type) {
      case "keydown":
        this.callHandlers(this.props.keyDownHandlers, event);
        break;
      case "keypress":
        this.callHandlers(this.props.keyPressHandlers, event);
        break;
      case "keyup":
        this.callHandlers(this.props.keyUpHandlers, event);
        break;
      default:
        break;
    }
  };

  render() {
    return <div style={{ display: "none" }} ref={(el) => (this.el = el ?? undefined)} />;
  }
}
