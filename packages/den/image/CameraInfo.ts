// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

type FloatArray = number[] | Float32Array | Float64Array;

export type CameraInfo = Readonly<{
  width: number;
  height: number;
  binning_x: number;
  binning_y: number;
  roi: {
    x_offset: number;
    y_offset: number;
    height: number;
    width: number;
    do_rectify: boolean;
  };
  distortion_model: string; // Usually "plumb_bob" | "rational_polynomial" | ""
  D: FloatArray;
  K: FloatArray;
  P: FloatArray;
  R: FloatArray;
}>;
