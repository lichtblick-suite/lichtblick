// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useLayoutEffect, useRef } from "react";
import createREGL from "regl";
import styled from "styled-components";

const Container = styled.div`
  z-index: 10000;
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

export default function Snow({ type }: { type: "snow" | "confetti" }): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(ReactNull);

  const typeRef = useRef(type);
  typeRef.current = type;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const regl = createREGL(container);

    const COUNT = 100;
    const xOffset = new Array(COUNT).fill(0).map(() => Math.random());
    const yOffset = new Array(COUNT).fill(0).map(() => Math.random());
    const phase = new Array(COUNT).fill(0).map(() => Math.random());
    const distance = new Array(COUNT).fill(0).map(() => Math.random());

    const drawSnow = regl({
      primitive: "points",
      uniforms: {
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
          gl_FragColor = vec4(1.0, 1.0, 1.0, 1.0);
        }
      }
      `,
    });
    const frame = regl.frame(() => {
      regl.clear({ color: [0, 0, 0, 0] });
      drawSnow({ isConfetti: typeRef.current === "confetti" });
    });
    return () => {
      frame.cancel();
      regl.destroy();
    };
  }, []);

  return <Container ref={containerRef} />;
}
