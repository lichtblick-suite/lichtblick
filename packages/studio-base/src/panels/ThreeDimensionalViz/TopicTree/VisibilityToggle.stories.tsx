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

import { storiesOf } from "@storybook/react";
import { useState, useCallback, useRef } from "react";

import { Color } from "@foxglove/regl-worldview";

import VisibilityToggle, { Size, TOGGLE_SIZE_CONFIG } from "./VisibilityToggle";

function Example({
  available,
  checked: defaultChecked = false,
  overrideColor,
  size,
  title,
  visibleInScene = false,
  showFocused = false,
  showToggled = false,
  diffModeEnabled = false,
  columnIndex = 0,
}: {
  available: boolean;
  checked?: boolean;
  overrideColor?: Color;
  size?: Size;
  title: string;
  visibleInScene?: boolean;
  showFocused?: boolean;
  showToggled?: boolean;
  diffModeEnabled?: boolean;
  columnIndex?: number;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  const onToggle = useCallback(() => {
    setChecked((currentChecked) => !currentChecked);
  }, []);
  const renderedRef = useRef(false);
  return (
    <div
      style={{ marginBottom: 16 }}
      ref={(el) => {
        if (!el || renderedRef.current) {
          return;
        }
        if (showToggled || showFocused) {
          const toggleEl = el.querySelector(`[data-test="myToggle"]`) as HTMLInputElement;
          if (showToggled) {
            toggleEl.click();
          } else if (showFocused) {
            toggleEl.focus();
          }
        }
        renderedRef.current = true;
      }}
    >
      <p>{title}</p>
      <VisibilityToggle
        available={available}
        checked={checked}
        onToggle={onToggle}
        visibleInScene={visibleInScene}
        size={size}
        overrideColor={overrideColor}
        dataTest="myToggle"
        diffModeEnabled={diffModeEnabled}
        columnIndex={columnIndex}
      />
    </div>
  );
}

storiesOf("panels/ThreeDimensionalViz/TopicTree/VisibilityToggle", module)
  .add("default", () => {
    return (
      <div>
        <Example available={false} title="available: false" />
        <Example available checked visibleInScene title="checked: true, visibleInScene: true" />
        <Example available visibleInScene title="visibleInScene: true" />
        <Example
          available
          visibleInScene={false}
          checked={false}
          title="visibleInScene: false, checked: false"
        />
        <Example
          available
          visibleInScene={false}
          checked
          title="visibleInScene: false, checked: true"
        />
        <Example
          available
          checked
          visibleInScene
          size={TOGGLE_SIZE_CONFIG.SMALL.name as any}
          title="checked: true, visibleInScene: true, size: SMALL "
        />
        <Example
          available
          checked
          visibleInScene
          overrideColor={{ r: 0.58, g: 0.78, b: 0, a: 1 }}
          title="checked: true, visibleInScene: true, overrideColor: { r: 0.58, g: 0.78, b: 0, a: 1 }"
        />
        <Example
          available
          visibleInScene
          overrideColor={{ r: 0.58, g: 0.78, b: 0, a: 1 }}
          title="checked: false, visibleInScene: true, overrideColor: { r: 0.58, g: 0.78, b: 0, a: 1 }"
        />
        <Example
          available
          checked
          visibleInScene={false}
          overrideColor={{ r: 0.58, g: 0.78, b: 0, a: 1 }}
          title="checked: true, visibleInScene: false, overrideColor: { r: 0.58, g: 0.78, b: 0, a: 1 }"
        />
        <Example
          available
          showToggled
          checked
          visibleInScene
          title="checked: true, visibleInScene: true, click to toggle checked"
        />
      </div>
    );
  })
  .add(
    "focused when checked is false",
    () => {
      return (
        <Example
          available
          showFocused
          visibleInScene
          title="checked: false, visibleInScene: true, show focused state"
        />
      );
    },
    { colorScheme: "dark" },
  )
  .add(
    "focused state when checked is true",
    () => {
      return (
        <Example
          available
          showFocused
          checked
          visibleInScene
          title="checked: true, visibleInScene: true, show focused state"
        />
      );
    },
    { colorScheme: "dark" },
  )
  .add(
    "focused when checked is false light",
    () => {
      return (
        <Example
          available
          showFocused
          visibleInScene
          title="checked: false, visibleInScene: true, show focused state"
        />
      );
    },
    { colorScheme: "light" },
  )
  .add(
    "focused state when checked is true light",
    () => {
      return (
        <Example
          available
          showFocused
          checked
          visibleInScene
          title="checked: true, visibleInScene: true, show focused state"
        />
      );
    },
    { colorScheme: "light" },
  )
  .add("diff mode", () => {
    return (
      <div>
        <Example
          available
          checked
          visibleInScene
          diffModeEnabled={true}
          columnIndex={0}
          title="diffModeEnabled: true, checked: true, columnIndex: 0"
        />
        <Example
          available
          checked
          visibleInScene
          diffModeEnabled={true}
          columnIndex={1}
          title="diffModeEnabled: true, checked: true, columnIndex: 1"
        />
        <Example
          available
          visibleInScene
          diffModeEnabled={true}
          columnIndex={0}
          title="diffModeEnabled: true, checked: false, columnIndex: 0"
        />
        <Example
          available
          visibleInScene
          diffModeEnabled={true}
          columnIndex={1}
          title="diffModeEnabled: true, checked: false, columnIndex: 1"
        />
      </div>
    );
  });
