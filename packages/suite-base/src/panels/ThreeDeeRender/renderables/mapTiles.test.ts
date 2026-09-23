// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { mapTiles, mapTileUrl, MAX_MAP_LATITUDE, validateMapUrl } from "./mapTiles";

describe("map tiles", () => {
  it("places the equator/prime meridian at the correct tile corner with north up", () => {
    const tile = mapTiles(0, 0, 18, 0)[0]!;
    expect(tile.x).toBe(131072);
    expect(tile.y).toBe(131072);
    expect(tile.size).toBeCloseTo(152.874, 3);
    expect(tile.east).toBeCloseTo(tile.size / 2);
    expect(tile.north).toBeCloseTo(-tile.size / 2);
  });
  it("uses ground meters at the origin latitude", () => {
    expect(mapTiles(60, 0, 18, 0)[0]!.size).toBeCloseTo(mapTiles(0, 0, 18, 0)[0]!.size / 2);
  });
  it("wraps the dateline without a gap in local positions", () => {
    const tiles = mapTiles(0, 179.9999, 18, 1);
    expect(tiles).toHaveLength(9);
    expect(tiles.slice(0, 3).map((tile) => tile.x)).toEqual([262142, 262143, 0]);
    expect(tiles[2]!.east - tiles[1]!.east).toBeCloseTo(tiles[0]!.size);
  });
  it("clips tiles at the Mercator poles and bounds the requested area", () => {
    for (const lat of [-MAX_MAP_LATITUDE, MAX_MAP_LATITUDE]) {
      expect(mapTiles(lat, 0, 18, 3).every((tile) => tile.y >= 0 && tile.y < 2 ** 18)).toBe(true);
    }
    expect(mapTiles(0, 0, 18, 3)).toHaveLength(49);
  });
  it("supports XYZ, TMS, explicit inverted Y and subdomains", () => {
    const template = "https://{s}.example.com/{z}/{x}/{y}/{-y}.png";
    expect(mapTileUrl(template, { x: 2, y: 3 }, 4, "xyz")).toBe(
      "https://a.example.com/4/2/3/12.png",
    );
    expect(mapTileUrl(template, { x: 2, y: 3 }, 4, "tms")).toBe(
      "https://a.example.com/4/2/12/12.png",
    );
  });
  it("validates raster URL templates", () => {
    expect(validateMapUrl("https://example.com/{z}/{x}/{y}.png")).toBe(true);
    expect(validateMapUrl("http://localhost:8000/{z}/{x}/{-y}.jpg")).toBe(true);
    expect(validateMapUrl("https://example.com/style.json")).toBe(false);
    expect(validateMapUrl("file:///{z}/{x}/{y}")).toBe(false);
  });
});
