// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { isLayoutEqual } from "./compareLayouts";

describe("isLayoutEqual", () => {
  it("should return true for the same layout", () => {
    expect(
      isLayoutEqual(
        {
          configById: {
            panelId: { field: 1 },
          },
          globalVariables: {},
          userNodes: {},
          playbackConfig: { speed: 1 },
        },
        {
          configById: {
            panelId: { field: 1 },
          },
          globalVariables: {},
          userNodes: {},
          playbackConfig: { speed: 1 },
        },
      ),
    ).toEqual(true);
  });

  it("should return true when incoming layout has extra undefined field", () => {
    expect(
      isLayoutEqual(
        {
          configById: {
            panelId: { field: 1 },
          },
          globalVariables: {},
          userNodes: {},
          playbackConfig: { speed: 1 },
        },
        {
          configById: {
            panelId: { field: 1, foo: undefined },
          },
          globalVariables: {},
          userNodes: {},
          playbackConfig: { speed: 1 },
        },
      ),
    ).toEqual(true);
  });

  it("should return false when incoming layout has new field", () => {
    expect(
      isLayoutEqual(
        {
          configById: {
            panelId: { field: 1, another: 2 },
          },
          globalVariables: {},
          userNodes: {},
          playbackConfig: { speed: 1 },
        },
        {
          configById: {
            panelId: { field: 1 },
          },
          globalVariables: {},
          userNodes: {},
          playbackConfig: { speed: 1 },
        },
      ),
    ).toEqual(false);
  });

  // A removed undefined field is considered as a changed layout so we can cleanup unused fields
  it("should return false when existing layout has extra undefined field", () => {
    expect(
      isLayoutEqual(
        {
          configById: {
            panelId: { field: 1, foo: undefined },
          },
          globalVariables: {},
          userNodes: {},
          playbackConfig: { speed: 1 },
        },
        {
          configById: {
            panelId: { field: 1 },
          },
          globalVariables: {},
          userNodes: {},
          playbackConfig: { speed: 1 },
        },
      ),
    ).toEqual(false);
  });
});
