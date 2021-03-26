// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Model } from "./VelodyneTypes";
import HDL32E_json from "./data/calibration/32db.json";
import HDL64E_S21_json from "./data/calibration/64e_s2.1-sztaki.json";
import HDL64E_S3_json from "./data/calibration/64e_s3-xiesc.json";
import HDL64E_json from "./data/calibration/64e_utexas.json";
import VLP16HiRes_json from "./data/calibration/VLP16_hires_db.json";
import VLP16_json from "./data/calibration/VLP16db.json";
import VLS128_json from "./data/calibration/VLS128.json";
import VLP32C_json from "./data/calibration/VeloView-VLP-32C.json";

export type LaserEntry = {
  rot_correction: number;
  vert_correction: number;
  dist_correction: number;
  two_pt_correction_available?: boolean;
  dist_correction_x: number;
  dist_correction_y: number;
  vert_offset_correction: number;
  horiz_offset_correction: number;
  max_intensity?: number;
  min_intensity?: number;
  focal_distance: number;
  focal_slope: number;
  laser_id: number;
};

export type CalibrationData = {
  lasers: LaserEntry[];
  distance_resolution: number;
};

// Load the default calibration data for a given Velodyne model
export function loadCalibrationData(model: Model): CalibrationData {
  switch (model) {
    case Model.VLP16:
      return VLP16_json as CalibrationData;
    case Model.VLP16HiRes:
      return VLP16HiRes_json as CalibrationData;
    case Model.VLP32C:
      return VLP32C_json as CalibrationData;
    case Model.HDL32E:
      return HDL32E_json as CalibrationData;
    case Model.HDL64E:
      return HDL64E_json as CalibrationData;
    case Model.HDL64E_S21:
      return HDL64E_S21_json as CalibrationData;
    case Model.HDL64E_S3:
      return HDL64E_S3_json as CalibrationData;
    case Model.VLS128:
      return VLS128_json as CalibrationData;
  }
}
