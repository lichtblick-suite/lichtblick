// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export const MAX_MAP_LATITUDE = 85.05112878;
const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6378137;

export type MapTile = { x: number; y: number; east: number; north: number; size: number };

/** Web Mercator tiles placed in a local east/north plane, in ground meters at the origin. */
export function mapTiles(
  latitude: number,
  longitude: number,
  zoom: number,
  radius: number,
): MapTile[] {
  const count = 2 ** zoom;
  const radians = (latitude * Math.PI) / 180;
  const originX = ((longitude + 180) / 360) * count;
  const originY = ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * count;
  const size = (EARTH_CIRCUMFERENCE * Math.cos(radians)) / count;
  const tiles: MapTile[] = [];
  for (
    let y = Math.max(0, Math.floor(originY) - radius);
    y <= Math.min(count - 1, Math.floor(originY) + radius);
    y++
  ) {
    for (let x = Math.floor(originX) - radius; x <= Math.floor(originX) + radius; x++) {
      tiles.push({
        x: ((x % count) + count) % count,
        y,
        east: (x + 0.5 - originX) * size,
        north: (originY - y - 0.5) * size,
        size,
      });
    }
  }
  return tiles;
}

export function mapTileUrl(
  template: string,
  tile: Pick<MapTile, "x" | "y">,
  zoom: number,
  scheme: "xyz" | "tms",
): string {
  const invertedY = 2 ** zoom - 1 - tile.y;
  return template
    .replaceAll("{z}", String(zoom))
    .replaceAll("{x}", String(tile.x))
    .replaceAll("{y}", String(scheme === "tms" ? invertedY : tile.y))
    .replaceAll("{-y}", String(invertedY))
    .replaceAll("{s}", "a");
}

export function validateMapUrl(template: string): boolean {
  try {
    const url = new URL(mapTileUrl(template, { x: 0, y: 0 }, 0, "xyz"));
    return (
      ["http:", "https:"].includes(url.protocol) &&
      ["{z}", "{x}"].every((token) => template.includes(token)) &&
      (template.includes("{y}") || template.includes("{-y}"))
    );
  } catch {
    return false;
  }
}
