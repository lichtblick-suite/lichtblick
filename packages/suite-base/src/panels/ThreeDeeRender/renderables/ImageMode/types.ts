// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import { ImageModeConfig } from "@lichtblick/suite-base/panels/ThreeDeeRender/IRenderer";
import { DEFAULT_IMAGE_CONFIG } from "@lichtblick/suite-base/panels/ThreeDeeRender/renderables/ImageMode/constants";

export interface ImageModeEventMap extends THREE.Object3DEventMap {
  hasModifiedViewChanged: object;
}

export type ConfigWithDefaults = ImageModeConfig & typeof DEFAULT_IMAGE_CONFIG;
