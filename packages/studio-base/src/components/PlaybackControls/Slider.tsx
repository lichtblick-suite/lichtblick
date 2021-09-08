// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { clamp } from "lodash";
import { useCallback, useEffect, useRef, MouseEvent, ReactNode, useMemo } from "react";
import styled from "styled-components";

import Logger from "@foxglove/log";

const log = Logger.getLogger(__filename);

type Props = {
  value: number | undefined;
  min: number;
  max: number;
  disabled?: boolean;
  step?: number;
  draggable?: boolean;
  onChange: (value: number) => void;
  onHoverOver?: (ev: MouseEvent<HTMLDivElement>, value: number) => void;
  onHoverOut?: () => void;
  renderSlider?: (value?: number) => ReactNode;
};

const StyledSlider = styled.div<{ disabled?: boolean }>`
  width: 100%;
  height: 100%;
  position: relative;
  cursor: ${({ disabled = false }) => (disabled ? "not-allowed" : "pointer")};
  border-radius: 2px;
`;

const StyledRange = styled.div.attrs<{ width: number }>(({ width }) => ({
  style: { width: `${width * 100}%` },
}))<{ width: number }>`
  background-color: rgba(255, 255, 255, 0.2);
  position: absolute;
  height: 100%;
  border-radius: 2px;
`;

function defaultRenderSlider(value: number | undefined): ReactNode {
  if (value == undefined || isNaN(value)) {
    return ReactNull;
  }
  return <StyledRange width={value} />;
}

export default function Slider(props: Props): JSX.Element {
  const {
    value,
    step = 0,
    max = 0,
    min = 0,
    draggable = false,
    disabled = false,
    renderSlider = defaultRenderSlider,
    onHoverOver,
    onHoverOut,
    onChange,
  } = props;

  const elRef = useRef<HTMLDivElement | ReactNull>(ReactNull);

  const mouseDownRef = useRef(false);

  const getValueAtMouse = useCallback(
    (ev: MouseEvent<HTMLDivElement>): number => {
      if (!elRef.current) {
        return 0;
      }
      const { left, width } = elRef.current.getBoundingClientRect();
      const { clientX } = ev;
      const t = (clientX - left) / width;
      let interpolated = min + t * (max - min);
      if (step != undefined && step !== 0) {
        interpolated = Math.round(interpolated / step) * step;
      }
      return clamp(interpolated, min, max);
    },
    [max, min, step],
  );

  const onClick = useCallback(
    (ev: MouseEvent<HTMLDivElement>): void => {
      if (disabled || draggable) {
        return;
      }
      onChange(getValueAtMouse(ev));
    },
    [disabled, draggable, getValueAtMouse, onChange],
  );

  const onMouseUp = useCallback((): void => {
    mouseDownRef.current = false;
  }, []);

  const onMouseMove = useCallback(
    (ev: MouseEvent<HTMLDivElement>): void => {
      const val = getValueAtMouse(ev);
      if (disabled) {
        return;
      }

      onHoverOver?.(ev, val);
      if (!draggable || !mouseDownRef.current) {
        return;
      }
      onChange(val);
    },
    [disabled, draggable, getValueAtMouse, onChange, onHoverOver],
  );

  const onMouseDown = useCallback(
    (ev: MouseEvent<HTMLDivElement>): void => {
      if (disabled || !draggable) {
        return;
      }
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      ev.preventDefault();
      onChange(getValueAtMouse(ev));
      mouseDownRef.current = true;
    },
    [disabled, draggable, getValueAtMouse, onChange],
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

  return (
    <StyledSlider
      disabled={disabled}
      ref={elRef}
      onClick={onClick}
      onMouseUp={onMouseUp}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseOut={onHoverOut}
    >
      {renderSlider(sliderValue)}
    </StyledSlider>
  );
}
