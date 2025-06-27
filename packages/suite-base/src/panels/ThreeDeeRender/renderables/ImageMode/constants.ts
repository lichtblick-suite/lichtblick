// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export const IMAGE_TOPIC_PATH = ["imageMode", "imageTopic"];
export const DECODE_IMAGE_ERR_KEY = "CreateBitmap";

export const IMAGE_MODE_HUD_GROUP_ID = "IMAGE_MODE";

export const BOTH_TOPICS_DO_NOT_EXIST_HUD_ITEM_ID = "BOTH_TOPICS_DO_NOT_EXIST";
export const IMAGE_TOPIC_DOES_NOT_EXIST_HUD_ITEM_ID = "IMAGE_TOPIC_DOES_NOT_EXIST";
export const CALIBRATION_TOPIC_DOES_NOT_EXIST_HUD_ITEM_ID = "CALIBRATION_TOPIC_DOES_NOT_EXIST";
export const WAITING_FOR_SYNC_NOTICE_HUD_ID = "WAITING_FOR_SYNC_NOTICE";
export const WAITING_FOR_SYNC_EMPTY_HUD_ID = "WAITING_FOR_SYNC_EMPTY";
export const WAITING_FOR_IMAGES_EMPTY_HUD_ID = "WAITING_FOR_IMAGES_EMPTY";
export const WAITING_FOR_BOTH_MESSAGES_HUD_ID = "WAITING_FOR_BOTH_MESSAGES";
export const WAITING_FOR_CALIBRATION_HUD_ID = "WAITING_FOR_CALIBRATION";
export const WAITING_FOR_IMAGES_NOTICE_ID = "WAITING_FOR_IMAGES_NOTICE";

export const MIN_BRIGHTNESS = 0;
export const MAX_BRIGHTNESS = 100;
export const MID_BRIGHTNESS = (MAX_BRIGHTNESS + MIN_BRIGHTNESS) / 2;

export const MIN_CONTRAST = 0;
export const MAX_CONTRAST = 100;
export const MID_CONTRAST = (MAX_CONTRAST + MIN_CONTRAST) / 2;

export const LOWER_BRIGHTNESS_LIMIT = -0.6;
export const UPPER_BRIGHTNESS_LIMIT = 0.6;

export const LOWER_CONTRAST_LIMIT = 0.1;
export const UPPER_CONTRAST_LIMIT = 1.9;

export const VERTEX_SHADER = `
    varying vec2 vUv;
    void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;

export const FRAGMENT_SHADER = `
    uniform sampler2D map;
    uniform float brightness;
    uniform float contrast;
    uniform vec3 color;
    uniform float opacity;
    varying vec2 vUv;

    void main() {
    vec4 texColor = texture2D(map, vUv);

    // Apply brightness
    texColor.rgb += brightness;

    // Apply contrast
    texColor.rgb = ((texColor.rgb - 0.5) * contrast) + 0.5;

    // Apply tint color and opacity
    texColor.rgb *= color;
    texColor.a *= opacity;

    gl_FragColor = texColor;
    }
`;
