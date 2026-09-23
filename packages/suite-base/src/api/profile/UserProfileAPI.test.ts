// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { UserProfile } from "@lichtblick/suite-base/context/UserProfileStorageContext";
import HttpService from "@lichtblick/suite-base/services/http/HttpService";
import { BasicBuilder } from "@lichtblick/test-builders";

import { UserProfileAPI } from "./UserProfileAPI";

jest.mock("@lichtblick/suite-base/services/http/HttpService");

describe("UserProfileAPI", () => {
  let userProfileAPI: UserProfileAPI;

  const createMockHttpResponse = <T>(data: T) => ({
    data,
    timestamp: new Date().toISOString(),
    path: "/test",
  });

  beforeEach(() => {
    userProfileAPI = new UserProfileAPI();
    jest.clearAllMocks();
  });

  describe("getUserProfile", () => {
    it("should fetch and unwrap the profile from the response", async () => {
      // Given
      const mockProfile: UserProfile = {
        currentLayoutId: BasicBuilder.string() as never,
        favoriteLayoutIds: BasicBuilder.strings() as never,
      };
      const mockGet = jest.fn().mockResolvedValue(createMockHttpResponse({ profile: mockProfile }));
      jest.mocked(HttpService).get = mockGet;

      // When
      const result = await userProfileAPI.getUserProfile();

      // Then
      expect(mockGet).toHaveBeenCalledWith("profile/lichtblick");
      expect(result).toEqual(mockProfile);
    });
  });

  describe("setUserProfile", () => {
    it("should send the full profile wrapped under a profile key", async () => {
      // Given
      const mockProfile: UserProfile = {
        currentLayoutId: BasicBuilder.string() as never,
      };
      const mockPut = jest.fn().mockResolvedValue(createMockHttpResponse(undefined));
      jest.mocked(HttpService).put = mockPut;

      // When
      await userProfileAPI.setUserProfile(mockProfile);

      // Then
      expect(mockPut).toHaveBeenCalledWith("profile/lichtblick", { profile: mockProfile });
    });
  });
});
