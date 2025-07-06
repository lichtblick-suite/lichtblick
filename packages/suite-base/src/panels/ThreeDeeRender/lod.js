// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
export var DetailLevel;
(function (DetailLevel) {
    DetailLevel[DetailLevel["Low"] = 0] = "Low";
    DetailLevel[DetailLevel["Medium"] = 1] = "Medium";
    DetailLevel[DetailLevel["High"] = 2] = "High";
})(DetailLevel || (DetailLevel = {}));
/** Returns the number of samples used for Multi-Sample Anti-Aliasing (MSAA) */
export function msaaSamples(capabilities) {
    // NOTE: Type definition workaround
    return capabilities.maxSamples ?? 0;
}
export function arrowShaftSubdivisions(lod) {
    switch (lod) {
        case DetailLevel.Low:
            return 12;
        case DetailLevel.Medium:
            return 20;
        case DetailLevel.High:
            return 32;
    }
}
export function arrowHeadSubdivisions(lod) {
    switch (lod) {
        case DetailLevel.Low:
            return 12;
        case DetailLevel.Medium:
            return 20;
        case DetailLevel.High:
            return 32;
    }
}
export function cylinderSubdivisions(lod) {
    switch (lod) {
        case DetailLevel.Low:
            return 12;
        case DetailLevel.Medium:
            return 20;
        case DetailLevel.High:
            return 32;
    }
}
export function sphereSubdivisions(lod) {
    switch (lod) {
        case DetailLevel.Low:
            return 10;
        case DetailLevel.Medium:
            return 24;
        case DetailLevel.High:
            return 32;
    }
}
