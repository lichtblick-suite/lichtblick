// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { cameraInfoTopicMatches } from "./Images";

describe("cameraInfoTopicMatches", () => {
  it("matches topics with common namespace conventions", () => {
    expect(cameraInfoTopicMatches("/a/image_raw", "/a/camera_info")).toBe(true);
    expect(cameraInfoTopicMatches("/a/image", "/a/camera_info")).toBe(true);

    expect(cameraInfoTopicMatches("/camera/image_raw/compressed", "/camera/camera_info")).toBe(
      true,
    );
    expect(
      cameraInfoTopicMatches(
        "/camera/image_raw/compressed",
        "/camera/image_raw/compressed/camera_info",
      ),
    ).toBe(true);
  });
});
