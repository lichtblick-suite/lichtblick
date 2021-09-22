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

import { Layer, mergeStyleSets } from "@fluentui/react";
import cx from "classnames";
import {
  ReactElement,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import Flex from "@foxglove/studio-base/components/Flex";
import KeyListener from "@foxglove/studio-base/components/KeyListener";

const classes = mergeStyleSets({
  childContainer: {
    position: "fixed",
    pointerEvents: "none",
  },
});

type ContainsOpenProps = {
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  onChange: (containsOpen: boolean) => void;
  children: React.ReactNode;
};

// eslint-disable-next-line @foxglove/no-boolean-parameters
const Context = React.createContext((_opening: boolean) => {});

// Component for detecting if any child component is opened or not. Handy for
// not hiding things when there is a dropdown open or so.
// Use as <ChildToggle.ContainsOpen>
function ChildToggleContainsOpen({ onChange, children }: ContainsOpenProps): ReactElement {
  const openNumber = useRef(0);
  const tellAncestorAboutToggledChild = useCallback(
    // eslint-disable-next-line @foxglove/no-boolean-parameters
    (opening: boolean) => {
      const newValue = openNumber.current + (opening ? 1 : -1);
      console.assert(newValue >= 0);
      if (openNumber.current > 0 !== newValue > 0) {
        onChange(newValue > 0);
      }
      openNumber.current = newValue;
    },
    [onChange],
  );
  return <Context.Provider value={tellAncestorAboutToggledChild}>{children}</Context.Provider>;
}

type Props = {
  isOpen?: boolean;
  defaultIsOpen?: boolean;
  // fired when the trigger component is clicked
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  onToggle?: (isOpen: boolean) => void;
  // requires exactly 2 components: a toggle trigger & a content component
  children: [ReactNode, ReactNode];
  style?: React.CSSProperties;
  // alignment of the content component
  position: "above" | "below" | "left" | "right" | "bottom-left";
  // don't use a portal, e.g. if you are nesting this already in a portal
  noPortal?: boolean;
  dataTest?: string;
};

// a component which takes 2 child components: toggle trigger and content
// when the toggle trigger component is clicked the onToggle callback will fire
// setting isOpen to true will show the content component, floating below the trigger component
export default function ChildToggle(props: Props): ReactElement {
  const {
    isOpen: controlledIsOpen,
    defaultIsOpen,
    onToggle,
    dataTest,
    children,
    position,
    noPortal = false,
    style,
  } = props;

  if (controlledIsOpen != undefined && defaultIsOpen != undefined) {
    throw new Error(
      "ChildToggle was provided both isOpen (controlled mode) and defaultIsOpen (uncontrolled). Pass only one.",
    );
  }

  const [uncontrolledIsOpen, uncontrolledSetIsOpen] = useState(defaultIsOpen ?? false);

  // Whether we are actually open, regardless of controlled or uncontrolled mode.
  const isOpen = controlledIsOpen ?? uncontrolledIsOpen;

  // Track the latest passed-in props to avoid needing to re-create the setIsOpen callback when values change.
  const latestProps = useRef({ onToggle, controlledIsOpen });
  useLayoutEffect(() => {
    latestProps.current.onToggle = props.onToggle;
    latestProps.current.controlledIsOpen = props.isOpen;
  });

  // Used by the internal click handler and escape key handler to change state.
  // eslint-disable-next-line @foxglove/no-boolean-parameters
  const setIsOpen = useCallback((value: boolean) => {
    // Only trigger a state update in uncontrolled mode. Otherwise, the client will do it from onToggle.
    if (latestProps.current.controlledIsOpen == undefined) {
      uncontrolledSetIsOpen(value);
    }
    latestProps.current.onToggle?.(value);
  }, []);

  const el = useRef<HTMLDivElement>(ReactNull);
  const floatingEl = useRef<HTMLDivElement>(ReactNull);

  // Inform the ancestor when we open/close. This enables ChildToggle.ContainsOpen to work.
  const previousIsOpen = useRef(false);
  const tellAncestorAboutToggledChild = useContext(Context);
  useLayoutEffect(() => {
    if (isOpen !== previousIsOpen.current) {
      tellAncestorAboutToggledChild(isOpen);
      previousIsOpen.current = isOpen;
    }
    // If we are being unmounted, tell the ancestor we are no longer open.
    // If we are being moved to a new ancestor, this cleanup handler runs before the new effect,
    // so we will automatically also tell the new ancestor that we are open (if applicable).
    return () => {
      if (previousIsOpen.current) {
        tellAncestorAboutToggledChild(false);
        previousIsOpen.current = false;
      }
    };
  }, [isOpen, tellAncestorAboutToggledChild]);

  // add a document listener to hide the dropdown body if
  // it is expanded and the document is clicked on
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const listener = (event: MouseEvent) => {
      if (!floatingEl.current) {
        return;
      }
      const node = event.target as HTMLElement;
      // if there was a click outside this container and outside children[0]
      // fire the toggle callback to close expanded section
      if (floatingEl.current.contains(node) || (el.current?.contains(node) ?? false)) {
        // the click was inside our bounds and shouldn't auto-close the menu
      } else {
        // allow any nested child toggle click events to reach their dom node before removing
        // the expanded toggle portion from the dom
        setImmediate(() => setIsOpen(false));
      }
    };
    document.addEventListener("click", listener, { capture: true });
    return () => document.removeEventListener("click", listener, { capture: true });
  }, [isOpen, setIsOpen]);

  const [rendered, setRendered] = useState(false);
  useLayoutEffect(() => {
    // Force an update because el.current is not set during the first render.
    // This is only important if isOpen was true on the first render.
    if (!rendered) {
      setRendered(true);
    }
  }, [rendered]);

  function renderFloating() {
    const childEl = el.current?.firstElementChild?.firstElementChild;
    if (!childEl) {
      return;
    }
    // position menu relative to our children[0]
    const childRect = childEl.getBoundingClientRect();
    const padding = 10;
    const styleObj: React.CSSProperties = {
      ...style,
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
    };

    let spacerSize;
    if (position === "left") {
      styleObj.top = childRect.top;
      spacerSize = window.innerWidth - childRect.left - padding;
    } else if (position === "below") {
      // Floating menu should have 4px overlap with the toggle element above it
      styleObj.top = childRect.top + childRect.height - 4;
      spacerSize = childRect.left - padding;
    } else if (position === "bottom-left") {
      // Floating menu should have 4px overlap with the toggle element above it
      styleObj.top = childRect.top + childRect.height - 4;
      spacerSize = window.innerWidth - childRect.right - padding;
    } else if (position === "above") {
      delete styleObj.bottom;
      styleObj.height = childRect.top - padding;
      spacerSize = childRect.left - padding;
    } else {
      styleObj.top = childRect.top;
      spacerSize = childRect.left + childRect.width - padding;
    }

    const tree = (
      <div ref={floatingEl}>
        <Flex
          row
          reverse={position === "left" || position === "bottom-left"}
          start={position !== "above"}
          end={position === "above"}
          className={classes.childContainer}
          style={styleObj}
        >
          {/* shrinkable spacer allows child to have a default position but slide over when it would go offscreen */}
          <span style={{ flexBasis: spacerSize, flexShrink: 1 }} />
          {children[1]}
        </Flex>
      </div>
    );

    return noPortal ? tree : <Layer eventBubblingEnabled>{tree}</Layer>;
  }

  const keyDownHandlers = {
    Escape: () => {
      setIsOpen(false);
    },
  };

  return (
    <div
      ref={el}
      className={cx({ open: isOpen })}
      style={style}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        onClick={(event) => {
          event.stopPropagation();
          event.preventDefault();
          setIsOpen(!isOpen);
        }}
        data-test={dataTest}
      >
        {children[0]}
      </div>
      {isOpen && renderFloating()}
      {isOpen && <KeyListener global keyDownHandlers={keyDownHandlers} />}
    </div>
  );
}

export { ChildToggleContainsOpen };
