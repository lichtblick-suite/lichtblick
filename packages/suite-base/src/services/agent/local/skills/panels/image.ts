// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { Skill } from "../types";

/**
 * The `Image` panel (panels/Image re-exports panels/ThreeDeeRender). Config verified against
 * panels/ThreeDeeRender/renderables/ImageMode: imageMode.imageTopic + calibrationTopic drive the
 * view, and without a calibration topic the panel runs image-only.
 */
export const PANEL_IMAGE_SKILL: Skill = {
  id: "panel-image",
  name: "Image panel: camera view configuration",
  whenToUse: "Before proposing a layout that uses the Image panel — image and calibration topics.",
  indexed: false,
  body: `# The \`Image\` panel

Topic-based panel: configured with topic names. It is the same renderer as the \`3D\` panel in
image mode; the difference is only which config keys are used.

Configure under \`imageMode\`:

- Image topics: \`sensor_msgs/Image\`, \`sensor_msgs/CompressedImage\`, \`foxglove.RawImage\`,
  \`foxglove.CompressedImage\`, \`foxglove.CompressedVideo\`.
- Calibration topics: \`sensor_msgs/CameraInfo\`, \`foxglove.CameraCalibration\`.
- Annotation topics: \`foxglove.ImageAnnotations\`, \`visualization_msgs/ImageMarker\`,
  \`visualization_msgs/ImageMarkerArray\`.

\`\`\`json
{ "lichtblickPanelTitle": "Camera feed", "imageMode": { "imageTopic": "/camera/image_raw", "calibrationTopic": "/camera/camera_info" } }
\`\`\`

**Constraint:** without \`calibrationTopic\` the panel runs image-only and 3D overlays are not
drawn. Set it whenever calibration exists and annotations or projected geometry are wanted.

For a camera wall with several feeds, prefer one \`Image\` panel per camera in a Mosaic column.
For compressed-video topics, keep the number of simultaneously decoded video panels low — decoding
several video streams at once degrades playback.

See the panel-catalog skill for how \`Image\` competes with \`3D\` when the user asks for a
camera view.`,
};
