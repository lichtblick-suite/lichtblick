// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0
import { normalizeHeader, normalizeTime } from "../normalizeMessages";
const tempVec = { x: 0, y: 0, z: 0 };
const tempVec2 = { x: 0, y: 0, z: 0 };
export function projectPixel(out, uv, cameraModel, settings) {
    if (settings.planarProjectionFactor === 0) {
        cameraModel.projectPixelTo3dRay(out, uv);
    }
    else if (settings.planarProjectionFactor === 1) {
        cameraModel.projectPixelTo3dPlane(out, uv);
    }
    else {
        cameraModel.projectPixelTo3dRay(tempVec, uv);
        cameraModel.projectPixelTo3dPlane(tempVec2, uv);
        lerpVec3(out, tempVec, tempVec2, settings.planarProjectionFactor);
    }
    multiplyScalar(out, settings.distance);
    return out;
}
export function cameraInfosEqual(a, b) {
    if (!a || !b) {
        return a === b;
    }
    else if (a === b) {
        return true;
    }
    if (!(a.header.frame_id === b.header.frame_id &&
        a.width === b.width &&
        a.height === b.height &&
        a.distortion_model === b.distortion_model &&
        a.binning_x === b.binning_x &&
        a.binning_y === b.binning_y &&
        a.roi.x_offset === b.roi.x_offset &&
        a.roi.y_offset === b.roi.y_offset &&
        a.roi.height === b.roi.height &&
        a.roi.width === b.roi.width &&
        a.roi.do_rectify === b.roi.do_rectify &&
        a.D.length === b.D.length)) {
        return false;
    }
    for (let i = 0; i < a.D.length; i++) {
        if (a.D[i] !== b.D[i]) {
            return false;
        }
    }
    for (let i = 0; i < 9; i++) {
        if (a.K[i] !== b.K[i]) {
            return false;
        }
    }
    for (let i = 0; i < 9; i++) {
        if (a.R[i] !== b.R[i]) {
            return false;
        }
    }
    for (let i = 0; i < 12; i++) {
        if (a.P[i] !== b.P[i]) {
            return false;
        }
    }
    return true;
}
export function normalizeCameraInfo(message) {
    // Handle lowercase field names as well (ROS2 compatibility)
    const D = message.D ?? message.d;
    const K = message.K ?? message.k;
    const R = message.R ?? message.r;
    const P = message.P ?? message.p;
    const Dlen = D?.length ?? 0;
    const Klen = K?.length ?? 0;
    const Rlen = R?.length ?? 0;
    const Plen = P?.length ?? 0;
    return {
        header: "timestamp" in message
            ? { stamp: normalizeTime(message.timestamp), frame_id: message.frame_id ?? "" }
            : normalizeHeader(message.header),
        height: message.height ?? 0,
        width: message.width ?? 0,
        distortion_model: message.distortion_model ?? "",
        D: Dlen > 0 ? D : [],
        K: Klen === 9 ? K : [],
        R: Rlen === 9 ? R : [],
        P: Plen === 12 ? P : [],
        binning_x: message.binning_x ?? 0,
        binning_y: message.binning_y ?? 0,
        roi: normalizeRegionOfInterest(message.roi),
    };
}
function normalizeRegionOfInterest(roi) {
    if (!roi) {
        return { x_offset: 0, y_offset: 0, height: 0, width: 0, do_rectify: false };
    }
    return {
        x_offset: roi.x_offset ?? 0,
        y_offset: roi.y_offset ?? 0,
        height: roi.height ?? 0,
        width: roi.width ?? 0,
        do_rectify: roi.do_rectify ?? false,
    };
}
function lerpVec3(out, a, b, t) {
    out.x = a.x + (b.x - a.x) * t;
    out.y = a.y + (b.y - a.y) * t;
    out.z = a.z + (b.z - a.z) * t;
}
function multiplyScalar(vec, scalar) {
    vec.x *= scalar;
    vec.y *= scalar;
    vec.z *= scalar;
}
