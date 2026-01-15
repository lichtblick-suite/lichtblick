// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Metadata } from "@lichtblick/suite";
import { freezeMetadata } from "@lichtblick/suite-base/players/IterablePlayer/freezeMetadata";

describe("freezeMetadata", () => {
  const metadata: Metadata[] = [
    { name: "Metadata1", metadata: { key: "value1" } },
    { name: "Metadata2", metadata: { key: "value2" } },
  ];

  freezeMetadata(metadata);

  const wrongMetadata: Metadata = { name: "WrongMetadata", metadata: { key: "test" } };

  // Expect data to be unchanged after all tests, even throwing error.
  const checkMetadataUnchanged = () => {
    expect(metadata).toEqual([
      { name: "Metadata1", metadata: { key: "value1" } },
      { name: "Metadata2", metadata: { key: "value2" } },
    ]);
  };

  it("should access successfully all properties", () => {
    expect(metadata).toEqual([
      { name: "Metadata1", metadata: { key: "value1" } },
      { name: "Metadata2", metadata: { key: "value2" } },
    ]);
  });

  it("should fail when attempting to change the metadata array", () => {
    // Can't add a new metadata entry in the array
    expect(() => {
      metadata.push(wrongMetadata);
    }).toThrow();

    // Can't replace a metadata entry
    expect(() => {
      metadata[0] = wrongMetadata;
    }).toThrow();

    // Can't remove metadata
    expect(() => {
      metadata.pop();
    }).toThrow();

    checkMetadataUnchanged();
  });

  it("should fail when attempting to change the metadata name", () => {
    expect(() => {
      // @ts-expect-error because data is typed as readonly, but the test is really for it in runtime
      metadata[0].name = "Wrong name";
    }).toThrow();

    checkMetadataUnchanged();
  });

  it("should fail when attempting to change the metadata record", () => {
    // Can't replace the metadata
    expect(() => {
      // @ts-expect-error because data is typed as readonly, but the test is really for it in runtime
      metadata[0].metadata = {};
    }).toThrow();

    // Can't delete a key from the metadata
    expect(() => {
      // @ts-expect-error because data is typed as readonly, but the test is really for it in runtime
      delete metadata[0].metadata.key;
    }).toThrow();

    // Can't add a new key on metadata record
    expect(() => {
      // @ts-expect-error because data is typed as readonly, but the test is really for it in runtime
      metadata[0].metadata["wrongKey"] = "wrongMetadata";
    }).toThrow();

    // Can't replace a value from a specific key of metadata record
    expect(() => {
      // @ts-expect-error because data is typed as readonly, but the test is really for it in runtime
      metadata[0].metadata.key = "wrongMetadata";
    }).toThrow();

    checkMetadataUnchanged();
  });

  it("should freeze an empty array", () => {
    const emptyMetadata: Metadata[] = [];

    freezeMetadata(emptyMetadata);

    expect(() => {
      metadata.push(wrongMetadata);
    }).toThrow();

    checkMetadataUnchanged();
  });
});
