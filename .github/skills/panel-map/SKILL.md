---
description: "Deep Map panel knowledge: Leaflet lifecycle, NavSatFix/LocationFix/GeoJSON handling, tile layers, and the FilteredPointLayer pixel-deduplication grid that bounds rendering cost."
---

# Panel Map Skill

A geographic visualization tool built on Leaflet for displaying GPS/NavSatFix data.

## Structure

```
panels/Map/
├── MapPanel.tsx          # main panel, Leaflet lifecycle, PanelExtensionContext
├── FilteredPointLayer.ts # performance-critical point deduplication
├── support.ts            # message type detection (NavSatFix, GeoJSON, GPS)
└── config.ts             # settings tree, tile layer config
```

## Leaflet Integration

- Map instance created on mount, destroyed on unmount
- Tile layers configurable (OpenStreetMap default, custom tile servers)
- Markers use `FeatureGroup` for efficient bulk operations
- View can follow the latest GPS point (auto-center)

## FilteredPointLayer (Performance Critical)

**Pixel-deduplication using a sparse 2D grid.**

### Problem
GPS at 10 Hz for 1 hour = 36,000 points. Rendering each as a Leaflet marker is prohibitively slow.

### Solution
```
Screen space is divided into a sparse grid of pixel-sized cells.
Each cell holds at most ONE marker.
Points overlapping in screen space → only one is rendered.
On zoom change → the grid is recalculated.
```

### Implementation
- Sparse 2D grid indexed by `` `${Math.floor(pixelX)},${Math.floor(pixelY)}` ``
- A new point mapping to an occupied cell is skipped (deduplicated)
- Result: `O(visible pixels)` markers instead of `O(data points)`
- Zoom in → more cells visible → more points; zoom out → heavy dedup → fast

## Supported Message Types

| Message Type | Fields Used |
|--------------|-------------|
| `sensor_msgs/NavSatFix` | latitude, longitude, altitude |
| `sensor_msgs/msg/NavSatFix` | (ROS 2 variant) |
| `foxglove.LocationFix` | latitude, longitude, altitude |
| GeoJSON | Feature / FeatureCollection geometry |

## Performance Notes

- `FilteredPointLayer` is the primary optimization — bounds rendering cost
- `FeatureGroup` enables bulk add/remove (single DOM update)
- Only the visible viewport bounds are processed
- Leaflet handles tile caching internally
- An upper bound on stored points prevents unbounded memory growth

## Key Files
- `packages/suite-base/src/panels/Map/MapPanel.tsx`
- `packages/suite-base/src/panels/Map/FilteredPointLayer.ts`
- `packages/suite-base/src/panels/Map/support.ts`
- `packages/suite-base/src/panels/Map/config.ts`
