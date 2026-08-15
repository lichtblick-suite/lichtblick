// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { SafeStorage } from "electron";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import SecureCredentialsService from "./SecureCredentialsService";

type SafeStorageApi = Pick<
  SafeStorage,
  | "decryptString"
  | "encryptString"
  | "getSelectedStorageBackend"
  | "isEncryptionAvailable"
>;

function fakeSafeStorage(): SafeStorageApi {
  return {
    decryptString: jest.fn((encrypted) => {
      const encoded = encrypted.toString("utf8");
      if (!encoded.startsWith("encrypted:")) {
        throw new Error("invalid ciphertext");
      }
      return Buffer.from(encoded.slice("encrypted:".length), "base64").toString(
        "utf8",
      );
    }),
    encryptString: jest.fn((value) =>
      Buffer.from(`encrypted:${Buffer.from(value).toString("base64")}`),
    ),
    getSelectedStorageBackend: jest.fn(() => "gnome_libsecret"),
    isEncryptionAvailable: jest.fn(() => true),
  };
}

function encryptedValue(value: string): string {
  return Buffer.from(
    `encrypted:${Buffer.from(value).toString("base64")}`,
  ).toString("base64");
}

function serializeTestValue(value: unknown): string {
  const serialized = JSON.stringify(value);
  if (serialized == undefined) {
    throw new Error("Unable to serialize test value");
  }
  return serialized;
}

describe("SecureCredentialsService", () => {
  let userDataPath: string;

  beforeEach(async () => {
    userDataPath = await mkdtemp(join(tmpdir(), "lichtblick-credentials-"));
  });

  afterEach(async () => {
    await rm(userDataPath, { force: true, recursive: true });
  });

  it("encrypts values at rest and preserves concurrent writes", async () => {
    const safeStorage = fakeSafeStorage();
    const service = new SecureCredentialsService({ safeStorage, userDataPath });

    await expect(
      Promise.all([
        service.set("agent.llmApiKey", "llm-secret"),
        service.set(
          "agent.profile.profile-123.llmApiKey",
          "profile-secret",
        ),
      ]),
    ).resolves.toEqual([{ ok: true }, { ok: true }]);

    const contents = await readFile(
      join(userDataPath, "agent-credentials.json"),
      "utf8",
    );
    expect(contents).not.toContain("llm-secret");
    expect(contents).not.toContain("profile-secret");
    expect(JSON.parse(contents)).toEqual({
      credentials: {
        "agent.llmApiKey": {
          backend: "gnome_libsecret",
          ciphertext: encryptedValue("llm-secret"),
        },
        "agent.profile.profile-123.llmApiKey": {
          backend: "gnome_libsecret",
          ciphertext: encryptedValue("profile-secret"),
        },
      },
      version: 2,
    });
    await expect(service.get("agent.llmApiKey")).resolves.toEqual({
      ok: true,
      value: "llm-secret",
    });
    await expect(
      service.get("agent.profile.profile-123.llmApiKey"),
    ).resolves.toEqual({
      ok: true,
      value: "profile-secret",
    });
    expect(safeStorage.encryptString).toHaveBeenCalledTimes(2);
    expect(safeStorage.decryptString).toHaveBeenCalledTimes(2);
  });

  it("accepts bounded profile keys and rejects arbitrary or malformed keys", async () => {
    const service = new SecureCredentialsService({
      safeStorage: fakeSafeStorage(),
      userDataPath,
    });
    const profileKey = "agent.profile.profile-123.llmApiKey";

    await expect(service.set(profileKey, "profile-secret")).resolves.toEqual({
      ok: true,
    });
    await expect(service.get(profileKey)).resolves.toEqual({
      ok: true,
      value: "profile-secret",
    });
    await expect(
      service.set("agent.profile.bad_id.llmApiKey", "secret"),
    ).rejects.toThrow("Unsupported secure credential key");
    await expect(
      service.set(`agent.profile.${"a".repeat(65)}.llmApiKey`, "secret"),
    ).rejects.toThrow("Unsupported secure credential key");
    await expect(
      service.get("agent.profile.profile-123.unrelated"),
    ).rejects.toThrow("Unsupported secure credential key");
    await expect(
      service.setMany([
        {
          key: "unrelated.key",
          value: serializeTestValue({ revision: "R1" }),
        },
      ] as never),
    ).resolves.toEqual({ code: "invalid-request", ok: false });
  });

  it("rejects arbitrary keys already present in the credentials file", async () => {
    await writeFile(
      join(userDataPath, "agent-credentials.json"),
      serializeTestValue({
        credentials: {
          "agent.profile.bad_id.llmApiKey": {
            backend: "gnome_libsecret",
            ciphertext: encryptedValue("secret"),
          },
        },
        version: 2,
      }),
    );
    const service = new SecureCredentialsService({
      safeStorage: fakeSafeStorage(),
      userDataPath,
    });

    await expect(service.get("agent.llmApiKey")).rejects.toThrow(
      "Unable to read secure credentials",
    );
  });

  it("does not write any entry when a setMany entry is invalid or encryption fails", async () => {
    const safeStorage = fakeSafeStorage();
    const service = new SecureCredentialsService({ safeStorage, userDataPath });
    await service.setMany([
      {
        key: "agent.llmApiKey",
        value: serializeTestValue({ revision: "R0", value: "old-llm" }),
      },
      {
        key: "agent.profile.profile-123.llmApiKey",
        value: serializeTestValue({ revision: "R0", value: "old-profile" }),
      },
    ]);
    const credentialsPath = join(userDataPath, "agent-credentials.json");
    const contentsBefore = await readFile(credentialsPath, "utf8");

    await expect(
      service.setMany([
        {
          expectedRevision: "R0",
          key: "agent.llmApiKey",
          value: serializeTestValue({ revision: "R1", value: "new-llm" }),
        },
        {
          expectedRevision: "R0",
          key: "unsupported.key",
          value: serializeTestValue({ revision: "R1", value: "new-profile" }),
        },
      ] as never),
    ).resolves.toEqual({ code: "invalid-request", ok: false });
    await expect(readFile(credentialsPath, "utf8")).resolves.toBe(
      contentsBefore,
    );

    jest
      .mocked(safeStorage.encryptString)
      .mockImplementationOnce((value) =>
        Buffer.from(`encrypted:${Buffer.from(value).toString("base64")}`),
      )
      .mockImplementationOnce(() => {
        throw new Error("encryption failed");
      });
    await expect(
      service.setMany([
        {
          expectedRevision: "R0",
          key: "agent.llmApiKey",
          value: serializeTestValue({ revision: "R1", value: "new-llm" }),
        },
        {
          expectedRevision: "R0",
          key: "agent.profile.profile-123.llmApiKey",
          value: serializeTestValue({ revision: "R1", value: "new-profile" }),
        },
      ]),
    ).rejects.toThrow("encryption failed");
    await expect(readFile(credentialsPath, "utf8")).resolves.toBe(
      contentsBefore,
    );
  });

  it("allows only one concurrent setMany writer for an expected revision", async () => {
    const safeStorage = fakeSafeStorage();
    const service = new SecureCredentialsService({ safeStorage, userDataPath });
    await service.setMany([
      {
        key: "agent.llmApiKey",
        value: serializeTestValue({ revision: "R0", value: "old-llm" }),
      },
      {
        key: "agent.profile.profile-123.llmApiKey",
        value: serializeTestValue({ revision: "R0", value: "old-profile" }),
      },
    ]);
    const makeEntries = (revision: string) => [
      {
        expectedRevision: "R0",
        key: "agent.llmApiKey" as const,
        value: serializeTestValue({ revision, value: `${revision}-llm` }),
      },
      {
        expectedRevision: "R0",
        key: "agent.profile.profile-123.llmApiKey" as const,
        value: serializeTestValue({ revision, value: `${revision}-profile` }),
      },
    ];

    const results = await Promise.all([
      service.setMany(makeEntries("R1")),
      service.setMany(makeEntries("R2")),
    ]);

    expect(results).toContainEqual({ ok: true });
    expect(results).toContainEqual({ code: "revision-conflict", ok: false });
    const llmResult = await service.get("agent.llmApiKey");
    const profileResult = await service.get(
      "agent.profile.profile-123.llmApiKey",
    );
    expect(llmResult.ok).toBe(true);
    expect(profileResult.ok).toBe(true);
    if (!llmResult.ok || !profileResult.ok) {
      throw new Error("Expected stored credentials");
    }
    const llm = JSON.parse(llmResult.value ?? "") as { revision: string };
    const profile = JSON.parse(profileResult.value ?? "") as {
      revision: string;
    };
    expect(["R1", "R2"]).toContain(llm.revision);
    expect(profile.revision).toBe(llm.revision);
  });

  it("reports a revision conflict when the single base record's revision changed", async () => {
    const service = new SecureCredentialsService({
      safeStorage: fakeSafeStorage(),
      userDataPath,
    });
    await service.set(
      "agent.llmApiKey",
      serializeTestValue({ revision: "R0", value: "old-llm" }),
    );

    await expect(
      service.setMany([
        {
          expectedRevision: "R0",
          key: "agent.llmApiKey",
          value: serializeTestValue({ revision: "R1", value: "new-llm" }),
        },
      ]),
    ).resolves.toEqual({ ok: true });
    // The base record is now at R1: a stale writer pinned to R0 must fail without changing it.
    await expect(
      service.setMany([
        {
          expectedRevision: "R0",
          key: "agent.llmApiKey",
          value: serializeTestValue({ revision: "R2", value: "stale-llm" }),
        },
      ]),
    ).resolves.toEqual({ code: "revision-conflict", ok: false });
    await expect(service.get("agent.llmApiKey")).resolves.toEqual({
      ok: true,
      value: serializeTestValue({ revision: "R1", value: "new-llm" }),
    });
  });

  it("deletes individual credentials and removes the file when none remain", async () => {
    const service = new SecureCredentialsService({
      safeStorage: fakeSafeStorage(),
      userDataPath,
    });
    await service.set("agent.llmApiKey", "llm-secret");
    await service.set(
      "agent.profile.profile-123.llmApiKey",
      "profile-secret",
    );

    await service.delete("agent.llmApiKey");
    await expect(service.get("agent.llmApiKey")).resolves.toEqual({
      ok: true,
      value: undefined,
    });
    await expect(
      service.get("agent.profile.profile-123.llmApiKey"),
    ).resolves.toEqual({
      ok: true,
      value: "profile-secret",
    });

    await service.delete("agent.profile.profile-123.llmApiKey");
    await expect(
      readFile(join(userDataPath, "agent-credentials.json"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not persist when encryption is unavailable or uses Linux basic_text", async () => {
    const unavailable = fakeSafeStorage();
    jest.mocked(unavailable.isEncryptionAvailable).mockReturnValue(false);
    const unavailableService = new SecureCredentialsService({
      safeStorage: unavailable,
      userDataPath,
    });

    await expect(unavailableService.set("other.key", "secret")).rejects.toThrow(
      "Unsupported secure credential key",
    );
    await expect(
      unavailableService.set("agent.llmApiKey", "secret"),
    ).resolves.toEqual({
      code: "backend-unavailable",
      ok: false,
    });
    expect(unavailable.encryptString).not.toHaveBeenCalled();

    const basicText = fakeSafeStorage();
    jest
      .mocked(basicText.getSelectedStorageBackend)
      .mockReturnValue("basic_text");
    const basicTextService = new SecureCredentialsService({
      safeStorage: basicText,
      userDataPath,
    });
    await expect(
      basicTextService.set("agent.llmApiKey", "secret"),
    ).resolves.toEqual({
      code: "insecure-backend",
      ok: false,
    });
    expect(basicText.encryptString).not.toHaveBeenCalled();
    await expect(
      readFile(join(userDataPath, "agent-credentials.json"), "utf8"),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("preserves secure records while the backend is temporarily unavailable", async () => {
    const safeStorage = fakeSafeStorage();
    const service = new SecureCredentialsService({ safeStorage, userDataPath });
    await service.set("agent.llmApiKey", "preserved-secret");
    const contentsBefore = await readFile(
      join(userDataPath, "agent-credentials.json"),
      "utf8",
    );

    jest.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(false);
    await expect(service.get("agent.llmApiKey")).resolves.toEqual({
      code: "backend-unavailable",
      ok: false,
    });
    expect(safeStorage.decryptString).not.toHaveBeenCalled();
    await expect(
      readFile(join(userDataPath, "agent-credentials.json"), "utf8"),
    ).resolves.toBe(contentsBefore);

    jest.mocked(safeStorage.isEncryptionAvailable).mockReturnValue(true);
    await expect(service.get("agent.llmApiKey")).resolves.toEqual({
      ok: true,
      value: "preserved-secret",
    });
  });

  it("marks legacy records insecure when the current backend is basic_text", async () => {
    const safeStorage = fakeSafeStorage();
    jest
      .mocked(safeStorage.getSelectedStorageBackend)
      .mockReturnValue("basic_text");
    await writeFile(
      join(userDataPath, "agent-credentials.json"),
      serializeTestValue({
        credentials: {
          "agent.llmApiKey": encryptedValue("legacy-secret"),
        },
        version: 1,
      }),
    );
    const service = new SecureCredentialsService({ safeStorage, userDataPath });

    await expect(service.get("agent.llmApiKey")).resolves.toEqual({
      code: "insecure-backend",
      ok: true,
      value: "legacy-secret",
    });
  });

  it("preserves an insecure marker when the current backend has become secure", async () => {
    const safeStorage = fakeSafeStorage();
    await writeFile(
      join(userDataPath, "agent-credentials.json"),
      serializeTestValue({
        credentials: {
          "agent.profile.profile-123.llmApiKey": {
            backend: "basic_text",
            ciphertext: encryptedValue("old-profile-secret"),
          },
        },
        version: 2,
      }),
    );
    const service = new SecureCredentialsService({ safeStorage, userDataPath });

    await expect(
      service.get("agent.profile.profile-123.llmApiKey"),
    ).resolves.toEqual({
      code: "insecure-backend",
      ok: true,
      value: "old-profile-secret",
    });
  });

  it("treats legacy records as secure when the current backend is secure", async () => {
    const safeStorage = fakeSafeStorage();
    await writeFile(
      join(userDataPath, "agent-credentials.json"),
      serializeTestValue({
        credentials: {
          "agent.llmApiKey": encryptedValue("legacy-secret"),
        },
        version: 1,
      }),
    );
    const service = new SecureCredentialsService({ safeStorage, userDataPath });

    await expect(service.get("agent.llmApiKey")).resolves.toEqual({
      ok: true,
      value: "legacy-secret",
    });
  });

  it("migrates a legacy version-1 record to the versioned format on the next write", async () => {
    const safeStorage = fakeSafeStorage();
    await writeFile(
      join(userDataPath, "agent-credentials.json"),
      serializeTestValue({
        credentials: {
          "agent.llmApiKey": encryptedValue("legacy-secret"),
        },
        version: 1,
      }),
    );
    const service = new SecureCredentialsService({ safeStorage, userDataPath });
    await expect(service.get("agent.llmApiKey")).resolves.toEqual({
      ok: true,
      value: "legacy-secret",
    });

    await expect(
      service.set(
        "agent.llmApiKey",
        serializeTestValue({ revision: "R1", value: "migrated-secret" }),
      ),
    ).resolves.toEqual({ ok: true });

    const contents = await readFile(
      join(userDataPath, "agent-credentials.json"),
      "utf8",
    );
    expect(JSON.parse(contents)).toEqual({
      credentials: {
        "agent.llmApiKey": {
          backend: "gnome_libsecret",
          ciphertext: encryptedValue(
            serializeTestValue({ revision: "R1", value: "migrated-secret" }),
          ),
        },
      },
      version: 2,
    });
  });

  it("reads the LLM key from a legacy dual-record file and drops the legacy entry on the next write", async () => {
    const safeStorage = fakeSafeStorage();
    await writeFile(
      join(userDataPath, "agent-credentials.json"),
      serializeTestValue({
        credentials: {
          "agent.llmApiKey": {
            backend: "gnome_libsecret",
            ciphertext: encryptedValue(
              serializeTestValue({ revision: "R0", value: "legacy-llm-secret" }),
            ),
          },
          "agent.vtdAuthToken": {
            backend: "gnome_libsecret",
            ciphertext: encryptedValue("legacy-vtd-secret"),
          },
        },
        version: 2,
      }),
    );
    const service = new SecureCredentialsService({ safeStorage, userDataPath });

    // A stale legacy entry must not make the whole file unreadable: the LLM key survives.
    await expect(service.get("agent.llmApiKey")).resolves.toEqual({
      ok: true,
      value: serializeTestValue({ revision: "R0", value: "legacy-llm-secret" }),
    });
    // The legacy key stays unreachable through the supported key surface.
    await expect(service.get("agent.vtdAuthToken")).rejects.toThrow(
      "Unsupported secure credential key",
    );

    // The next write rewrites the file without the legacy entry.
    await expect(
      service.set(
        "agent.llmApiKey",
        serializeTestValue({ revision: "R1", value: "new-llm-secret" }),
      ),
    ).resolves.toEqual({ ok: true });

    const contents = await readFile(
      join(userDataPath, "agent-credentials.json"),
      "utf8",
    );
    expect(contents).not.toContain("agent.vtdAuthToken");
    expect(contents).not.toContain("legacy-vtd-secret");
    expect(JSON.parse(contents)).toEqual({
      credentials: {
        "agent.llmApiKey": {
          backend: "gnome_libsecret",
          ciphertext: encryptedValue(
            serializeTestValue({ revision: "R1", value: "new-llm-secret" }),
          ),
        },
      },
      version: 2,
    });
  });

  it("tolerates a legacy version-1 entry next to a valid key and cleans it up on write", async () => {
    const safeStorage = fakeSafeStorage();
    await writeFile(
      join(userDataPath, "agent-credentials.json"),
      serializeTestValue({
        credentials: {
          "agent.llmApiKey": encryptedValue("legacy-string-llm"),
          "agent.vtdAuthToken": encryptedValue("legacy-string-vtd"),
        },
        version: 1,
      }),
    );
    const service = new SecureCredentialsService({ safeStorage, userDataPath });

    await expect(service.get("agent.llmApiKey")).resolves.toEqual({
      ok: true,
      value: "legacy-string-llm",
    });
    await expect(
      service.set("agent.llmApiKey", "replacement-secret"),
    ).resolves.toEqual({ ok: true });

    const contents = await readFile(
      join(userDataPath, "agent-credentials.json"),
      "utf8",
    );
    expect(contents).not.toContain("agent.vtdAuthToken");
    expect(JSON.parse(contents)).toEqual({
      credentials: {
        "agent.llmApiKey": {
          backend: "gnome_libsecret",
          ciphertext: encryptedValue("replacement-secret"),
        },
      },
      version: 2,
    });
  });

  it("rejects corrupt storage", async () => {
    const safeStorage = fakeSafeStorage();
    const service = new SecureCredentialsService({ safeStorage, userDataPath });

    const corruptContents = JSON.stringify({
      credentials: { "agent.llmApiKey": "not-base64!" },
      version: 1,
    });
    if (corruptContents == undefined) {
      throw new Error("Unable to serialize test credentials");
    }
    await writeFile(
      join(userDataPath, "agent-credentials.json"),
      corruptContents,
    );
    await expect(service.get("agent.llmApiKey")).rejects.toThrow(
      "invalid ciphertext",
    );
  });
});
