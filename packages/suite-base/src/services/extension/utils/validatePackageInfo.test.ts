// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import validatePackageInfo from "@lichtblick/suite-base/services/extension/utils/validatePackageInfo";
import { ExtensionInfo } from "@lichtblick/suite-base/types/Extensions";
import { BasicBuilder, Capitalization } from "@lichtblick/test-builders";

describe("validatePackageInfo", () => {
  const setup = (infoOverride: Partial<ExtensionInfo> = {}) => {
    const info: Pick<ExtensionInfo, "name" | "publisher"> = {
      name: BasicBuilder.string(),
      publisher: BasicBuilder.string(),
      ...infoOverride,
    };

    return {
      info,
    };
  };

  it("should convert the name to lowercase", () => {
    const packageName = BasicBuilder.string();
    const input: Partial<ExtensionInfo> = {
      name: `@${BasicBuilder.string()}/${packageName}`,
      publisher: BasicBuilder.string(),
    };

    const result = validatePackageInfo(input);

    expect(result.name).toBe(packageName.toLowerCase());
  });

  it("should prioritize an explicitly provided publisher over the extracted one", () => {
    const packageName = BasicBuilder.string({ capitalization: Capitalization.LOWERCASE });
    const publisher = BasicBuilder.string();
    const input: Partial<ExtensionInfo> = {
      name: `@extracted/${packageName}`,
      publisher,
    };

    const result = validatePackageInfo(input);

    expect(result.publisher).toBe(publisher);
    expect(result.name).toBe(packageName);
  });

  it("should return a valid ExtensionInfo object when input data is correct", () => {
    const packageName = BasicBuilder.string({ capitalization: Capitalization.LOWERCASE });
    const publisher = BasicBuilder.string();
    const { info } = setup({
      name: `@${BasicBuilder.string()}/${packageName}`,
      publisher,
    });

    const result = validatePackageInfo(info);

    expect(result).toEqual({
      publisher,
      name: packageName,
    });
  });

  it.each([
    {
      name: undefined,
      publisher: BasicBuilder.string(),
    },
    {
      name: "",
      publisher: BasicBuilder.string(),
    },
  ])("should throw an error if the name is missing", (extensionInfo: Partial<ExtensionInfo>) => {
    const { info } = setup(extensionInfo);

    expect(() => validatePackageInfo(info)).toThrow("Invalid extension: missing name");
  });

  it("should throw an error if the publisher is missing", () => {
    const nonStandardName = BasicBuilder.string();
    const input: Partial<ExtensionInfo> = { name: nonStandardName };

    expect(() => validatePackageInfo(input)).toThrow("Invalid extension: missing publisher");
  });

  it("should correctly extract the publisher from the name if not explicitly provided", () => {
    const packageName = BasicBuilder.string({ capitalization: Capitalization.LOWERCASE });
    const publisher = BasicBuilder.string({ capitalization: Capitalization.LOWERCASE });
    const { info } = setup({
      name: `@${publisher}/${packageName}`,
      publisher,
    });

    const result = validatePackageInfo(info);

    expect(result.publisher).toBe(publisher);
    expect(result.name).toBe(packageName);
  });

  it("should throw an error if the extracted publisher is an empty string", () => {
    const { info } = setup({
      name: "@/package",
      publisher: undefined,
    });

    expect(() => validatePackageInfo(info)).toThrow("Invalid extension: missing publisher");
  });
});
