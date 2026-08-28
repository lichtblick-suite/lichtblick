// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { randomUUID } from "crypto";
import type { SafeStorage } from "electron";
import { mkdir, readFile, rename, rm, unlink, writeFile } from "fs/promises";
import { dirname, join } from "path";

import {
  isSecureCredentialKey,
  type SecureCredentialGetResult,
  type SecureCredentialKey,
  type SecureCredentialSetManyEntry,
  type SecureCredentialSetManyResult,
  type SecureCredentialSetResult,
} from "../common/types";

const CREDENTIALS_FILE_NAME = "agent-credentials.json";
const CREDENTIALS_FILE_VERSION = 2;
const LEGACY_CREDENTIALS_FILE_VERSION = 1;

type SafeStorageBackend = ReturnType<SafeStorage["getSelectedStorageBackend"]>;

type StoredCredential = {
  backend?: SafeStorageBackend;
  ciphertext: string;
};

type StoredCredentials = {
  credentials: Partial<Record<SecureCredentialKey, StoredCredential>>;
  version: typeof CREDENTIALS_FILE_VERSION;
};

/**
 * Keys removed from the supported credential set. Files written by older builds may still
 * contain them — for example the former VTD authorization token that lived next to the LLM key
 * in the dual-base-record layout. They are ignored on read (one stale entry must not make the
 * whole file unreadable) and are dropped on the next write because parsed records never carry
 * them. They can never be requested through the IPC surface.
 */
const LEGACY_CREDENTIAL_KEYS = new Set<string>(["agent.vtdAuthToken"]);

type SafeStorageApi = Pick<
  SafeStorage,
  "decryptString" | "encryptString" | "getSelectedStorageBackend" | "isEncryptionAvailable"
>;

type SecureCredentialsServiceOptions = {
  safeStorage: SafeStorageApi;
  userDataPath: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != undefined && !Array.isArray(value);
}

function parseStoredCredentials(value: unknown): StoredCredentials {
  if (
    !isRecord(value) ||
    (value.version !== LEGACY_CREDENTIALS_FILE_VERSION &&
      value.version !== CREDENTIALS_FILE_VERSION) ||
    !isRecord(value.credentials)
  ) {
    throw new Error("Secure credentials file has an invalid format");
  }

  const credentials: Partial<Record<SecureCredentialKey, StoredCredential>> = {};
  const supportedBackends = new Set<SafeStorageBackend>([
    "basic_text",
    "gnome_libsecret",
    "kwallet",
    "kwallet5",
    "kwallet6",
    "unknown",
  ]);
  for (const [key, storedValue] of Object.entries(value.credentials)) {
    if (LEGACY_CREDENTIAL_KEYS.has(key)) {
      // Tolerate entries written by older builds; they are dropped here and cleaned up by the
      // next file write.
      continue;
    }
    if (!isSecureCredentialKey(key)) {
      throw new Error("Secure credentials file has an invalid entry");
    }
    if (typeof storedValue === "string") {
      credentials[key] = { ciphertext: storedValue };
      continue;
    }
    if (
      !isRecord(storedValue) ||
      typeof storedValue.ciphertext !== "string" ||
      (storedValue.backend != undefined &&
        !supportedBackends.has(storedValue.backend as SafeStorageBackend))
    ) {
      throw new Error("Secure credentials file has an invalid entry");
    }
    credentials[key] = {
      backend: storedValue.backend as SafeStorageBackend,
      ciphertext: storedValue.ciphertext,
    };
  }
  return { credentials, version: CREDENTIALS_FILE_VERSION };
}

/**
 * Protects credentials at rest from other OS users by using Electron safeStorage.
 *
 * Trust boundary: the Studio renderer is one trusted realm. User-installed extensions execute
 * with the application's full renderer privileges and are therefore trusted at the same level as
 * built-in code; this service does not attempt to isolate credentials from installed extensions.
 */
export default class SecureCredentialsService {
  readonly #credentialsPath: string;
  readonly #safeStorage: SafeStorageApi;
  #operationQueue = Promise.resolve();

  public constructor({ safeStorage, userDataPath }: SecureCredentialsServiceOptions) {
    this.#credentialsPath = join(userDataPath, CREDENTIALS_FILE_NAME);
    this.#safeStorage = safeStorage;
  }

  public async get(keyValue: unknown): Promise<SecureCredentialGetResult> {
    const key = this.#parseKey(keyValue);
    return await this.#enqueue(async () => {
      if (!this.#safeStorage.isEncryptionAvailable()) {
        return { code: "backend-unavailable", ok: false };
      }
      const stored = await this.#read();
      const storedCredential = stored.credentials[key];
      const currentBackend = this.#safeStorage.getSelectedStorageBackend();
      const value =
        storedCredential == undefined
          ? undefined
          : this.#safeStorage.decryptString(this.#decodeCiphertext(storedCredential.ciphertext));
      return currentBackend === "basic_text" || storedCredential?.backend === "basic_text"
        ? { code: "insecure-backend", ok: true, value }
        : { ok: true, value };
    });
  }

  public async set(keyValue: unknown, value: unknown): Promise<SecureCredentialSetResult> {
    const key = this.#parseKey(keyValue);
    if (typeof value !== "string") {
      throw new Error("Secure credential value must be a string");
    }
    const result = await this.setMany([{ key, value }]);
    if (!result.ok) {
      switch (result.code) {
        case "invalid-request":
          throw new Error("Secure credential entry is invalid");
        case "revision-conflict":
          throw new Error("Secure credential revision conflict");
        case "backend-unavailable":
          return { code: "backend-unavailable", ok: false };
        case "insecure-backend":
          return { code: "insecure-backend", ok: false };
      }
    }
    return { ok: true };
  }

  public async setMany(
    entriesValue: SecureCredentialSetManyEntry[],
  ): Promise<SecureCredentialSetManyResult> {
    return await this.#enqueue(async () => {
      const entries = this.#validateSetManyEntries(entriesValue);
      if (entries == undefined) {
        return { code: "invalid-request", ok: false };
      }
      const backend = this.#safeStorage.getSelectedStorageBackend();
      if (!this.#safeStorage.isEncryptionAvailable()) {
        return { code: "backend-unavailable", ok: false };
      }
      if (backend === "basic_text") {
        return { code: "insecure-backend", ok: false };
      }
      const stored = await this.#read();
      for (const entry of entries) {
        if (
          entry.expectedRevision != undefined &&
          this.#getStoredRevision(stored.credentials[entry.key]) !== entry.expectedRevision
        ) {
          return { code: "revision-conflict", ok: false };
        }
      }

      const replacements = entries.map((entry) => ({
        key: entry.key,
        storedCredential: {
          backend,
          ciphertext: this.#safeStorage.encryptString(entry.value).toString("base64"),
        },
      }));
      for (const replacement of replacements) {
        stored.credentials[replacement.key] = replacement.storedCredential;
      }
      await this.#write(stored);
      return { ok: true };
    });
  }

  public async delete(keyValue: unknown): Promise<void> {
    const key = this.#parseKey(keyValue);
    await this.#enqueue(async () => {
      const stored = await this.#read();
      if (stored.credentials[key] == undefined) {
        return;
      }
      delete stored.credentials[key];
      if (Object.keys(stored.credentials).length === 0) {
        await unlink(this.#credentialsPath).catch((error: unknown) => {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
            throw error;
          }
        });
        return;
      }
      await this.#write(stored);
    });
  }

  async #enqueue<Result>(operation: () => Promise<Result>): Promise<Result> {
    const result = this.#operationQueue.then(operation);
    this.#operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return await result;
  }

  #parseKey(value: unknown): SecureCredentialKey {
    if (!isSecureCredentialKey(value)) {
      throw new Error("Unsupported secure credential key");
    }
    return value;
  }

  #validateSetManyEntries(entriesValue: unknown): SecureCredentialSetManyEntry[] | undefined {
    if (!Array.isArray(entriesValue) || entriesValue.length === 0) {
      return undefined;
    }
    const entries: SecureCredentialSetManyEntry[] = [];
    const keys = new Set<SecureCredentialKey>();
    for (const entry of entriesValue) {
      if (
        !isRecord(entry) ||
        !isSecureCredentialKey(entry.key) ||
        typeof entry.value !== "string" ||
        (entry.expectedRevision != undefined && typeof entry.expectedRevision !== "string") ||
        keys.has(entry.key)
      ) {
        return undefined;
      }
      keys.add(entry.key);
      entries.push({
        ...(entry.expectedRevision == undefined
          ? {}
          : { expectedRevision: entry.expectedRevision }),
        key: entry.key,
        value: entry.value,
      });
    }
    return entries;
  }

  #getStoredRevision(storedCredential: StoredCredential | undefined): string {
    if (storedCredential == undefined) {
      return "";
    }
    const value = this.#safeStorage.decryptString(
      this.#decodeCiphertext(storedCredential.ciphertext),
    );
    try {
      const parsed: unknown = JSON.parse(value);
      return isRecord(parsed) && typeof parsed.revision === "string" ? parsed.revision : "";
    } catch {
      return "";
    }
  }

  #decodeCiphertext(value: string): Buffer {
    const ciphertext = Buffer.from(value, "base64");
    if (ciphertext.byteLength === 0 || ciphertext.toString("base64") !== value) {
      throw new Error("Secure credentials file contains invalid ciphertext");
    }
    return ciphertext;
  }

  async #read(): Promise<StoredCredentials> {
    let contents: string;
    try {
      contents = await readFile(this.#credentialsPath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return { credentials: {}, version: CREDENTIALS_FILE_VERSION };
      }
      throw error;
    }

    try {
      return parseStoredCredentials(JSON.parse(contents) as unknown);
    } catch (error) {
      throw new Error("Unable to read secure credentials", { cause: error });
    }
  }

  async #write(stored: StoredCredentials): Promise<void> {
    const temporaryPath = `${this.#credentialsPath}.${process.pid}.${randomUUID()}.tmp`;
    const contents = JSON.stringify(stored, undefined, 2);
    if (contents == undefined) {
      throw new Error("Unable to serialize secure credentials");
    }
    await mkdir(dirname(this.#credentialsPath), { recursive: true });
    try {
      await writeFile(temporaryPath, contents, {
        encoding: "utf8",
        flag: "wx",
        mode: 0o600,
      });
      await rename(temporaryPath, this.#credentialsPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }
}
