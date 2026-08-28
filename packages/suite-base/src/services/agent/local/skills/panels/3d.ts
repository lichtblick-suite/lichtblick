// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Skill } from "../types";

/**
 * The built-in `3D` panel (panels/ThreeDeeRender). Claims verified against the panel source:
 * topic visibility drives subscription, transforms are always subscribed, and an empty config is
 * a valid but empty scene.
 */
export const PANEL_3D_SKILL: Skill = {
  id: "panel-3d",
  name: "3D panel: scene rendering and configuration",
  whenToUse: "Before proposing a layout that uses the 3D panel — exact schema rules and config.",
  indexed: false,
  body: `# The \`3D\` panel

Topic-based panel: configured with topic names; the panel decides what to draw from each topic's
schema. The \`3D\` panel is the built-in scene renderer and the default choice for any 3D scene,
robot models included.

Renders a 3D scene from many topic kinds at once. Supported schemas, by what they draw:

| Draws | Schemas |
| --- | --- |
| Markers | \`visualization_msgs/Marker\`, \`visualization_msgs/MarkerArray\` |
| Scene entities | \`foxglove.SceneUpdate\` |
| Point clouds | \`sensor_msgs/PointCloud2\`, \`foxglove.PointCloud\` |
| Laser scans | \`sensor_msgs/LaserScan\`, \`foxglove.LaserScan\` |
| Velodyne scans | \`velodyne_msgs/VelodyneScan\` |
| Occupancy grids | \`nav_msgs/OccupancyGrid\` |
| Grids | \`foxglove.Grid\` |
| Poses | \`geometry_msgs/PoseStamped\`, \`geometry_msgs/PoseWithCovarianceStamped\`, \`foxglove.PoseInFrame\` |
| Pose arrays and paths | \`geometry_msgs/PoseArray\`, \`nav_msgs/Path\`, \`foxglove.PosesInFrame\` |
| Polygons | \`geometry_msgs/PolygonStamped\` |
| Camera frustums | \`sensor_msgs/CameraInfo\`, \`foxglove.CameraCalibration\` |
| Images on planes | \`sensor_msgs/Image\`, \`sensor_msgs/CompressedImage\`, \`foxglove.RawImage\`, \`foxglove.CompressedImage\`, \`foxglove.CompressedVideo\` |
| Robot model | \`sensor_msgs/JointState\`; URDF-as-string only from \`std_msgs/String\` |

Transforms are always subscribed: \`foxglove.FrameTransform\`, \`foxglove.FrameTransforms\`,
\`tf2_msgs/TFMessage\`, \`tf/tfMessage\`, \`geometry_msgs/TransformStamped\`.

**Required to show anything:** a topic is only subscribed when it is marked visible. Transforms
alone never produce geometry — there must also be a renderable topic (marker, point cloud, pose,
path, ...) with \`visible: true\`.

\`\`\`json
{ "lichtblickPanelTitle": "Point cloud scene", "topics": { "/points": { "visible": true }, "/tf": { "visible": true } } }
\`\`\`

An empty config \`{}\` is valid but renders an empty scene. Camera and scene settings can be
omitted; they have working defaults, and guessed keys are silently ignored — set only what the
user asked for.

See the panel-catalog skill for how to choose between \`3D\` and the \`Image\` panel (the same
renderer in image mode).`,
};
