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

import { ReadonlyVec3, vec3 } from "gl-matrix";
import { isEqual } from "lodash";
import { Component, createRef, KeyboardEvent } from "react";
import { cameraStateSelectors, CameraState, Vec3 } from "regl-worldview";

import styles from "@foxglove/studio-base/panels/ThreeDimensionalViz/PositionControl.module.scss";
import { isNonEmptyOrUndefined } from "@foxglove/studio-base/util/emptyOrUndefined";

type Props = {
  cameraState?: CameraState;
  onCameraStateChange: (arg0: CameraState) => void;
};

const TEMP_VEC3: vec3 = [0, 0, 0];
const ZERO_VEC3: ReadonlyVec3 = [0, 0, 0];

// make a best-effort attempt to x and y position out of the input
export function parsePosition(input: string): Vec3 | undefined {
  const parts = input.split(/\s*[,\n{}[\]]+\s*/).filter((part) => part !== "");
  const parseMatch = (val: string) => {
    const match = val.match(/-?\d+(\.\d+)?/);
    return match?.[0] != undefined ? Number.parseFloat(match[0]) : undefined;
  };
  // allow length 3 to ignore z value
  if (parts.length === 2 || parts.length === 3) {
    const x = parseMatch(parts[0]!);
    const y = parseMatch(parts[1]!);
    if (x != undefined && y != undefined) {
      return [x, y, 0];
    }
  }
  return undefined;
}

export default class PositionControl extends Component<Props> {
  lastValue?: string;
  _ref = createRef<HTMLDivElement>();

  onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === "Enter" || event.key === "Return") {
      event.stopPropagation();
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  onInput = (): void => {
    if (this._ref.current) {
      this.lastValue = this._ref.current.innerText;
    }
  };

  onFocus = (): void => {
    const { current: el } = this._ref;
    if (el) {
      const range = document.createRange();
      range.selectNodeContents(el);
      const sel = window.getSelection()!;
      sel.removeAllRanges();
      sel.addRange(range);
    }
  };

  onBlur = (): void => {
    window.getSelection()?.removeAllRanges();

    const { cameraState } = this.props;
    if (!cameraState) {
      return;
    }
    if (!isNonEmptyOrUndefined(this.lastValue)) {
      return;
    }

    const newPos = parsePosition(this.lastValue);
    if (newPos) {
      const { target, targetOffset } = cameraState;
      const targetHeading = cameraStateSelectors.targetHeading(cameraState);
      // extract the targetOffset by subtracting from the target and un-rotating by heading
      const newTargetOffset = vec3.rotateZ(
        [0, 0, 0],
        vec3.sub(TEMP_VEC3, newPos, target),
        ZERO_VEC3,
        targetHeading,
      ) as Vec3;
      if (!isEqual(targetOffset, newTargetOffset)) {
        this.props.onCameraStateChange({ ...cameraState, targetOffset: newTargetOffset });
        return;
      }
    }

    // if we didn't actually change the camera position, reset manually since we won't be getting new props
    this.resetValue();
  };

  override componentDidMount(): void {
    this.resetValue();
  }

  override componentDidUpdate(): void {
    this.resetValue();
  }

  resetValue(): void {
    const { current: el } = this._ref;
    if (!el) {
      return;
    }
    const { cameraState } = this.props;
    if (!cameraState) {
      return;
    }

    // show camera center position for now
    // TODO(jacob): maybe UI to switch between car, camera, and mouse position?
    const { target, targetOffset } = cameraState;
    const targetHeading = cameraStateSelectors.targetHeading(cameraState);

    const [x, y] = vec3.add(
      TEMP_VEC3,
      target,
      vec3.rotateZ(TEMP_VEC3, targetOffset, ZERO_VEC3, -targetHeading),
    );

    this.lastValue = undefined;
    el.innerHTML =
      `<b>x:</b> <span class="${styles.value}">${x}</span><br />` +
      `<b>y:</b> <span class="${styles.value}">${y}</span>`;
  }

  override render(): JSX.Element {
    return (
      <div
        ref={this._ref}
        className={styles.inputField}
        contentEditable={
          // "plaintext-only" is not supported by all browsers, and not covered by React typings
          "plaintext-only" as React.HTMLAttributes<HTMLDivElement>["contentEditable"]
        }
        onInput={this.onInput}
        onFocus={this.onFocus}
        onBlur={this.onBlur}
        onKeyDown={this.onKeyDown}
      />
    );
  }
}
