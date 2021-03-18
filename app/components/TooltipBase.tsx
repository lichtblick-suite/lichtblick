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

import * as PopperJS from "popper.js";
import { render, createPortal, unmountComponentAtNode } from "react-dom";
import { Manager, Reference, Popper } from "react-popper";

type Contents = React.ReactNode | (() => React.ReactNode);

export type Props = {
  children?: React.ReactElement<any>;
  contents: Contents;
  arrow?: React.ReactElement<any>;
  fixed?: boolean;
  delay?: boolean | number;
  offset: { x: number; y: number };
  placement?: PopperJS.Placement;
  defaultShown?: boolean;
  defaultMousePosition?: { x: number; y: number };
};

let portal: any;
function getPortal(): Element | undefined {
  const { body } = document;
  if (!body) {
    return undefined;
  }
  if (!portal) {
    portal = document.createElement("div");
    body.appendChild(portal);
  }
  return portal;
}

type State = {
  shown: boolean;
  mousePosition: { x: number; y: number } | undefined;
};

// Wrapper component to add tooltip listeners to your elements
export default class Tooltip extends React.Component<Props, State> {
  static defaultProps = {
    fixed: false,
    offset: { x: 0, y: 14 },
    defaultShown: false,
    defaultMousePosition: undefined,
    placement: "bottom",
  };

  timeout?: ReturnType<typeof setTimeout>;
  scheduleUpdate?: () => void;

  // fake element used for positioning the tooltip next to the mouse
  fakeReferenceElement = {
    getBoundingClientRect: () => {
      const { mousePosition = this.props.defaultMousePosition } = this.state;
      if (!mousePosition) {
        return { left: 0, top: 0, bottom: 0, right: 0, width: 0, height: 0 };
      }
      const { x, y } = mousePosition;
      return {
        left: x,
        top: y,
        right: x,
        bottom: y,
        width: 0,
        height: 0,
      };
    },
    clientWidth: 0,
    clientHeight: 0,
  };

  // show the tooltip at absolute position with given contents
  static show(x: number, y: number, contents: Contents, props?: Omit<Props, "contents">) {
    // extract defaultShown and defaultMousePosition from props since we specify those explicitly
    const { defaultShown: _, defaultMousePosition: __, ...rest } = props ?? {};
    const container = getPortal();
    // Don't throw since its just a tooltip
    if (!container) {
      console.warn("Could not get tooltip portal");
      return ReactNull;
    }
    return render(
      <Tooltip defaultShown defaultMousePosition={{ x, y }} contents={contents} {...rest} />,
      container,
    );
  }

  // hide the tooltip
  static hide() {
    unmountComponentAtNode(getPortal() as any);
  }

  constructor(props: Props) {
    super(props);

    this.state = {
      shown: props.defaultShown ?? false,
      mousePosition: undefined,
    };
  }

  componentDidUpdate() {
    // In the case where defaultShown is set and our defaultMousePosition changed,
    // we need to update the popper's position
    if (this.scheduleUpdate) {
      this.scheduleUpdate();
    }
  }

  onMouseEnter = (e: React.MouseEvent<Element>, force: boolean = false): void => {
    const { fixed, delay } = this.props;
    if (!fixed) {
      return;
    }

    if (force || !delay) {
      this.setState({ shown: true });
      return;
    }

    const delayTime = typeof delay === "number" ? delay : 500;
    this.timeout = setTimeout(this.onMouseEnter, delayTime, e, true) as any;
  };

  onMouseMove = (e: React.MouseEvent<Element>): void => {
    this.setState({ shown: true, mousePosition: { x: e.clientX, y: e.clientY } });
    if (this.scheduleUpdate) {
      this.scheduleUpdate();
    }
  };

  onMouseLeave = (_e: React.MouseEvent<Element>): void => {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.setState({ shown: false, mousePosition: undefined });
  };

  onMouseDown = (): void => {
    if (this.timeout) {
      clearTimeout(this.timeout);
    }
    this.setState({ shown: false, mousePosition: undefined });
  };

  renderPopper() {
    const { placement, contents, offset, fixed, arrow } = this.props;
    const { shown } = this.state;
    if (!shown) {
      return ReactNull;
    }

    // if we are positioning based on the mouse, hook up the fake reference element
    const referenceProps: any = {};
    if (!fixed) {
      referenceProps.referenceElement = this.fakeReferenceElement;
    }

    return (
      <Popper
        placement={placement}
        modifiers={{
          offset: { offset: `${offset.x},${offset.y}` },
          preventOverflow: { boundariesElement: "viewport" },
        }}
        {...referenceProps}
      >
        {({ ref, style, scheduleUpdate, placement: renderedPlacement, arrowProps }) => {
          const { body } = document;
          if (!body) {
            return ReactNull;
          }
          // hold onto the scheduleUpdate function so we can call it when the mouse moves
          this.scheduleUpdate = scheduleUpdate;
          return createPortal(
            <div
              ref={ref}
              style={{ ...style, zIndex: 99999, pointerEvents: "none" }}
              data-placement={renderedPlacement}
            >
              {arrow &&
                React.cloneElement(arrow, {
                  ref: arrowProps.ref,
                  style: { ...(arrow.props.style || {}), ...arrowProps.style },
                })}
              {typeof contents === "function" ? contents() : contents}
            </div>,
            body,
          );
        }}
      </Popper>
    );
  }

  render() {
    const { children, fixed } = this.props;

    if (!children) {
      return this.renderPopper();
    }

    const child = React.Children.only(children);
    const eventListeners: {
      [key: string]: (arg0: React.MouseEvent<Element>) => void;
    } = {
      onMouseLeave: this.onMouseLeave,
    };

    if (fixed) {
      eventListeners.onMouseEnter = this.onMouseEnter;
    } else {
      eventListeners.onMouseMove = this.onMouseMove;
    }

    eventListeners.onMouseDown = this.onMouseDown;

    if (fixed) {
      return (
        <Manager>
          <Reference>
            {({ ref }) => {
              return React.cloneElement(child, { ...eventListeners, ref });
            }}
          </Reference>
          {this.renderPopper()}
        </Manager>
      );
    }
    return (
      <>
        {React.cloneElement(child, eventListeners)}
        {this.renderPopper()}
      </>
    );
  }
}
