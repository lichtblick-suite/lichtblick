/** @jest-environment jsdom */

// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { MosaicNode } from "react-mosaic-component";

import { LayoutNode } from "@lichtblick/suite-base/components/Sidebars/types";
import {
  clampLeftSidebarPercentage,
  mosaicLeftSidebarSplitPercentage,
  mosaicRightSidebarSplitPercentage,
} from "@lichtblick/suite-base/components/Sidebars/utils";

describe("clampLeftSidebarPercentage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1000,
    });
  });
  it("should return the given percentage if it is greater than the minimum percentage", () => {
    const percentage = 50;
    const result = clampLeftSidebarPercentage(percentage);
    expect(result).toBe(50);
  });

  it("should return the minimum percentage if the given percentage is less", () => {
    const percentage = 1;
    const result = clampLeftSidebarPercentage(percentage);
    expect(result).toBeGreaterThan(percentage);
  });
});

describe("mosaicLeftSidebarSplitPercentage", () => {
  it("should return undefined if the node is not an object", () => {
    const result = mosaicLeftSidebarSplitPercentage("children");
    expect(result).toBeUndefined();
  });

  it("should return the split percentage if the node's first property is 'leftbar'", () => {
    const node: MosaicNode<LayoutNode> = {
      first: "leftbar",
      second: "children",
      direction: "row",
      splitPercentage: 30,
    };
    const result = mosaicLeftSidebarSplitPercentage(node);
    expect(result).toBe(30);
  });

  it("should recursively find the split percentage in nested nodes", () => {
    const node = {
      first: { first: "leftbar", splitPercentage: 40 },
      second: {},
    } as MosaicNode<LayoutNode>;
    const result = mosaicLeftSidebarSplitPercentage(node);
    expect(result).toBe(40);
  });

  it("should return undefined if no 'leftbar' is found", () => {
    const node = { first: {}, second: {} } as MosaicNode<LayoutNode>;
    const result = mosaicLeftSidebarSplitPercentage(node);
    expect(result).toBeUndefined();
  });
});

describe("mosaicRightSidebarSplitPercentage", () => {
  it("should return undefined if the node is not an object", () => {
    const result = mosaicRightSidebarSplitPercentage("children");
    expect(result).toBeUndefined();
  });

  it("should return the split percentage if the node's second property is 'rightbar'", () => {
    const node: MosaicNode<LayoutNode> = {
      second: "rightbar",
      splitPercentage: 25,
    } as MosaicNode<LayoutNode>;
    const result = mosaicRightSidebarSplitPercentage(node);
    expect(result).toBe(25);
  });

  it("should recursively find the split percentage in nested nodes", () => {
    const node = {
      first: {},
      second: { second: "rightbar", splitPercentage: 35 },
    } as MosaicNode<LayoutNode>;
    const result = mosaicRightSidebarSplitPercentage(node);
    expect(result).toBe(35);
  });

  it("should return undefined if no 'rightbar' is found", () => {
    const node = { first: {}, second: {} } as MosaicNode<LayoutNode>;
    const result = mosaicRightSidebarSplitPercentage(node);
    expect(result).toBeUndefined();
  });
});
