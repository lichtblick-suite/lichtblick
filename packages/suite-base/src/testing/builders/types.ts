// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

export type NumberBuilder = {
  min: number;
  max: number;
};

export type StringBuilder = {
  capitalization?: Capitalization;
  charset: "alphanumeric" | "alphabetic" | "numeric";
  count?: number;
  length: number;
};

export type MapBuilder = StringBuilder & {
  count?: number;
};

export enum Capitalization {
  LOWERCASE = "lowercase",
  UPPERCASE = "uppercase",
}

export type SamplePropertyKey = string | symbol | number;
