// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useTheme, getColorFromString } from "@fluentui/react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Transition, TransitionStatus } from "react-transition-group";
import createREGL from "regl";
import styled from "styled-components";

const SNOW_DURATION = 5000;
const FADE_OUT_DURATION = 1000;

const Container = styled.div<{ state: TransitionStatus }>`
  z-index: 10000;
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  transition: opacity ${FADE_OUT_DURATION}ms linear;
  opacity: ${({ state }) => (state === "exiting" ? 0 : 1)};
`;

export default function Snow({ type }: { type: "snow" | "confetti" }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(ReactNull);
  const [showSnow, setShowSnow] = useState(true);
  const [exited, setExited] = useState(false);

  const theme = useTheme();
  const themeColor = useMemo(() => {
    if (theme.isInverted) {
      return [1, 1, 1, 1];
    }
    const rgba = getColorFromString(theme.palette.themeTertiary);
    if (!rgba) {
      return [191 / 255, 164 / 255, 240 / 255, 1];
    }
    return [rgba.r / 255, rgba.g / 255, rgba.b / 255, (rgba.a ?? 100) / 100];
  }, [theme]);

  const themeColorRef = useRef(themeColor);
  themeColorRef.current = themeColor;

  const typeRef = useRef(type);
  typeRef.current = type;

  useLayoutEffect(() => {
    if (exited) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const regl = createREGL(container);
    const startExitTimeout = setTimeout(() => setShowSnow(false), SNOW_DURATION);

    const COUNT = 100;
    const xOffset = new Array(COUNT).fill(0).map(() => Math.random());
    const yOffset = new Array(COUNT).fill(0).map(() => Math.random());
    const phase = new Array(COUNT).fill(0).map(() => Math.random());
    const distance = new Array(COUNT).fill(0).map(() => Math.random());

    const drawSnow = regl({
      primitive: "points",
      uniforms: {
        themeColor: regl.prop("themeColor"),
        time: regl.context("time"),
        isConfetti: regl.prop("isConfetti"),
      },
      count: COUNT,
      attributes: {
        xOffset,
        yOffset,
        phase,
        distance,
      },
      vert: `
      uniform bool isConfetti;
      uniform float time;
      attribute float xOffset;
      attribute float yOffset;
      attribute float phase;
      attribute float distance;
      const float X_AMPLITUDE = 0.02;
      float MAX_SPEED = isConfetti ? 0.2 : 0.1;
      varying lowp float vPhase;
      void main() {
        vPhase = phase;
        float speed = mix(MAX_SPEED, 0.2 * MAX_SPEED, distance);
        float x = xOffset + X_AMPLITUDE * sin(phase * 2.0 * 3.141593 + time);
        float y = mod(yOffset + speed * time, 1.0);
        gl_Position = vec4(mix(-1.0, 1.0, x), mix(1.0, -1.0, y), 0.0, 1.0);
        gl_PointSize = mix(10.0, 5.0, distance);
      }
      `,
      frag: `
      uniform bool isConfetti;
      uniform lowp vec4 themeColor;
      varying lowp float vPhase;
      void main() {
        if (length(gl_PointCoord * 2.0 - 1.0) > 1.0) {
          discard;
        }
        if (isConfetti) {
          if (vPhase < 1.0/6.0)      gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);
          if (vPhase < 2.0/6.0)      gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
          else if (vPhase < 3.0/6.0) gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
          else if (vPhase < 4.0/6.0) gl_FragColor = vec4(0.0, 1.0, 1.0, 1.0);
          else if (vPhase < 5.0/6.0) gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
          else                       gl_FragColor = vec4(1.0, 1.0, 0.0, 1.0);
        } else {
          gl_FragColor = themeColor;
        }
      }
      `,
    });
    const frame = regl.frame(() => {
      regl.clear({ color: [0, 0, 0, 0] });
      drawSnow({ themeColor: themeColorRef.current, isConfetti: typeRef.current === "confetti" });
    });
    return () => {
      clearTimeout(startExitTimeout);
      frame.cancel();
      regl.destroy();
    };
  }, [exited]);

  return (
    <Transition
      in={showSnow}
      timeout={{ exit: FADE_OUT_DURATION }}
      unmountOnExit
      onExited={() => setExited(true)}
    >
      {(state) => <Container state={state} ref={containerRef} />}
    </Transition>
  );
}
