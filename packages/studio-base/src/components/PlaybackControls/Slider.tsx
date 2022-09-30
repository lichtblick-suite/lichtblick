// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { clamp } from "lodash";
import { useCallback, useEffect, useRef, ReactNode, useState, useLayoutEffect } from "react";
import { makeStyles } from "tss-react/mui";

import { scaleValue } from "@foxglove/den/math";

type Props = {
  fraction: number | undefined;
  disabled?: boolean;
  onChange: (value: number) => void;
  onHoverOver?: (value: number) => void;
  onHoverOut?: () => void;
  renderSlider?: (value?: number) => ReactNode;
};

const useStyles = makeStyles()((theme) => ({
  root: {
    label: "Slider-root",
    display: "flex",
    width: "100%",
    height: "100%",
    position: "relative",
    alignItems: "center",
    cursor: "pointer",
  },
  rootDisabled: {
    label: "Slider-rootDisabled",
    cursor: "not-allowed",
    opacity: theme.palette.action.disabledOpacity,
  },
  range: {
    label: "Slider-range",
    backgroundColor: theme.palette.action.active,
    position: "absolute",
    height: "100%",
  },
}));

function defaultRenderSlider(value: number | undefined, className: string): ReactNode {
  if (value == undefined || isNaN(value)) {
    return ReactNull;
  }
  return <div className={className} style={{ width: `${value * 100}%` }} />;
}

export default function Slider(props: Props): JSX.Element {
  const {
    fraction,
    disabled = false,
    renderSlider = defaultRenderSlider,
    onHoverOver,
    onHoverOut,
    onChange,
  } = props;
  const { classes, cx } = useStyles();

  const elRef = useRef<HTMLDivElement | ReactNull>(ReactNull);

  const getValueAtMouse = useCallback((ev: React.MouseEvent | MouseEvent): number => {
    if (!elRef.current) {
      return 0;
    }
    const { left, right } = elRef.current.getBoundingClientRect();
    const scaled = scaleValue(ev.clientX, left, right, 0, 1);
    return clamp(scaled, 0, 1);
  }, []);

  const [mouseDown, setMouseDown] = useState(false);
  const mouseDownRef = useRef(mouseDown);
  useLayoutEffect(() => {
    mouseDownRef.current = mouseDown;
  }, [mouseDown]);

  const [mouseInside, setMouseInside] = useState(false);
  const mouseInsideRef = useRef(mouseInside);
  useLayoutEffect(() => {
    mouseInsideRef.current = mouseInside;
  }, [mouseInside]);

  const onMouseEnter = useCallback(() => {
    setMouseInside(true);
  }, []);

  const onMouseLeave = useCallback(() => {
    setMouseInside(false);
    if (!mouseDownRef.current) {
      onHoverOut?.();
    }
  }, [onHoverOut]);

  const onPointerUp = useCallback((): void => {
    setMouseDown(false);
    if (!mouseInsideRef.current) {
      onHoverOut?.();
    }
  }, [onHoverOut]);

  const onPointerMove = useCallback(
    (ev: React.PointerEvent | PointerEvent): void => {
      const val = getValueAtMouse(ev);
      if (disabled) {
        return;
      }

      if (elRef.current) {
        onHoverOver?.(val);
      }
      if (!mouseDownRef.current) {
        return;
      }
      onChange(val);
    },
    [disabled, getValueAtMouse, onChange, onHoverOver],
  );

  const onPointerDown = useCallback(
    (ev: React.PointerEvent<HTMLDivElement>): void => {
      if (disabled) {
        return;
      }
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      ev.preventDefault();
      onChange(getValueAtMouse(ev));
      setMouseDown(true);
    },
    [disabled, getValueAtMouse, onChange],
  );

  useEffect(() => {
    if (mouseDown) {
      window.addEventListener("pointerup", onPointerUp);
      return () => {
        window.removeEventListener("pointerup", onPointerUp);
      };
    }
    return undefined;
  }, [mouseDown, onPointerMove, onPointerUp]);

  return (
    <div
      ref={elRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cx(classes.root, {
        [classes.rootDisabled]: disabled,
      })}
    >
      {renderSlider(fraction, classes.range)}
    </div>
  );
}
