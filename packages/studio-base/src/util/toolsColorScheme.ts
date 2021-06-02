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

import tinycolor from "tinycolor2";

export const toolsColorScheme = {
  base: {
    dark: "#1F1E27",
    medium: "#8B8B8D",
    light: "#F7F7F3",
  },
  red: {
    dark: "#F24366",
    medium: "#ff7c96",
    light: "#FFAABB",
  },
  blue: {
    dark: "#1b83ec",
    medium: "#4e98e2",
    light: "#77AADD",
  },
  paleGreen: {
    dark: "#B4CC00",
    medium: "#cad660",
    light: "#CDD67E",
  },
  orange: {
    dark: "#ea531f",
    medium: "#f5774d",
    light: "#faa487",
  },
  cyan: {
    dark: "#22b5ff",
    medium: "#61cbff",
    light: "#99DDFF",
  },
  green: {
    dark: "#05d27d",
    medium: "#5cd6a9",
    light: "#8de0c9",
  },
  purple: {
    dark: "#6E51EE",
    medium: "#a395e2",
    light: "#c7c0e7",
  },
  yellow: {
    dark: "#EDCC28",
    medium: "#f7df71",
    light: "#f1e4a",
  },
};

export const grey = tinycolor(`hsv(0, 0%, 75%)`).toHexString();
