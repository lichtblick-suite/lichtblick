// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { clamp } from "lodash";
import {
  useCallback,
  useEffect,
  useRef,
  ReactNode,
  useMemo,
  useState,
  useLayoutEffect,
} from "react";
import { makeStyles } from "tss-react/mui";

import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);

type Props = {
  value: number | undefined;
  min: number;
  max: number;
  disabled?: boolean;
  step?: number;
  onChange: (value: number) => void;
  onHoverOver?: (clientX: number, value: number) => void;
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
    value,
    step = 0,
    max = 0,
    min = 0,
    disabled = false,
    renderSlider = defaultRenderSlider,
    onHoverOver,
    onHoverOut,
    onChange,
  } = props;
  const { classes, cx } = useStyles();

  const elRef = useRef<HTMLDivElement | ReactNull>(ReactNull);

  const getValueAtMouse = useCallback(
    (ev: React.MouseEvent | MouseEvent): number => {
      if (!elRef.current) {
        return 0;
      }
      const { left, width } = elRef.current.getBoundingClientRect();
      const { clientX } = ev;
      const t = (clientX - left) / width;
      let interpolated = min + t * (max - min);
      if (step !== 0) {
        interpolated = Math.round(interpolated / step) * step;
      }
      return clamp(interpolated, min, max);
    },
    [max, min, step],
  );

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

  const onMouseUp = useCallback((): void => {
    setMouseDown(false);
    if (!mouseInsideRef.current) {
      onHoverOut?.();
    }
  }, [onHoverOut]);

  const onMouseMove = useCallback(
    (ev: React.MouseEvent | MouseEvent): void => {
      const val = getValueAtMouse(ev);
      if (disabled) {
        return;
      }

      if (elRef.current) {
        const { left, right } = elRef.current.getBoundingClientRect();
        onHoverOver?.(clamp(ev.clientX, left, right), val);
      }
      if (!mouseDownRef.current) {
        return;
      }
      onChange(val);
    },
    [disabled, getValueAtMouse, onChange, onHoverOver],
  );

  const onMouseDown = useCallback(
    (ev: React.MouseEvent<HTMLDivElement>): void => {
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
    if (max < min) {
      const msg = `Slider component given invalid range: ${min}, ${max}`;
      log.error(new Error(msg));
    }
  }, [min, max]);

  const sliderValue = useMemo(() => {
    return value != undefined && max > min ? (value - min) / (max - min) : undefined;
  }, [max, min, value]);

  useEffect(() => {
    if (mouseDown) {
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("mousemove", onMouseMove);
      return () => {
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("mousemove", onMouseMove);
      };
    }
    return undefined;
  }, [mouseDown, onMouseMove, onMouseUp]);

  return (
    <div
      ref={elRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cx(classes.root, {
        [classes.rootDisabled]: disabled,
      })}
    >
      {renderSlider(sliderValue, classes.range)}
    </div>
  );
}
