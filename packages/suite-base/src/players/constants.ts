// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Values of the contants below are a (more or less) informed guesses and not guaranteed to be accurate.
 */
export const COMPRESSED_POINTER_SIZE = 4; // Pointers use 4 bytes (also on 64-bit systems) due to pointer compression
export const OBJECT_BASE_SIZE = 3 * COMPRESSED_POINTER_SIZE; // 3 compressed pointers
// Arrays have an additional length property (1 pointer) and a backing store header (2 pointers)
// See https://stackoverflow.com/a/70550693.
export const ARRAY_BASE_SIZE = OBJECT_BASE_SIZE + 3 * COMPRESSED_POINTER_SIZE;
export const TYPED_ARRAY_BASE_SIZE = 25 * COMPRESSED_POINTER_SIZE; // byteLength, byteOffset, ..., see https://stackoverflow.com/a/45808835
export const SMALL_INTEGER_SIZE = COMPRESSED_POINTER_SIZE; // Small integers (up to 31 bits), pointer tagging
export const HEAP_NUMBER_SIZE = 8 + 2 * COMPRESSED_POINTER_SIZE; // 4-byte map pointer + 8-byte payload + property pointer
export const FIELD_SIZE_BY_PRIMITIVE: Record<string, number> = {
  bool: SMALL_INTEGER_SIZE,
  int8: SMALL_INTEGER_SIZE,
  uint8: SMALL_INTEGER_SIZE,
  int16: SMALL_INTEGER_SIZE,
  uint16: SMALL_INTEGER_SIZE,
  int32: SMALL_INTEGER_SIZE,
  uint32: SMALL_INTEGER_SIZE,
  float32: HEAP_NUMBER_SIZE,
  float64: HEAP_NUMBER_SIZE,
  int64: HEAP_NUMBER_SIZE,
  uint64: HEAP_NUMBER_SIZE,
  time: OBJECT_BASE_SIZE + 2 * HEAP_NUMBER_SIZE + COMPRESSED_POINTER_SIZE,
  duration: OBJECT_BASE_SIZE + 2 * HEAP_NUMBER_SIZE + COMPRESSED_POINTER_SIZE,
  string: 20, // we don't know the length upfront, assume a fixed length
};
export const MAX_NUM_FAST_PROPERTIES = 1020;

// Capabilities that are not shared by all players.
export const PLAYER_CAPABILITIES = {
  // Publishing messages. Need to be connected to some sort of live robotics system (e.g. ROS).
  advertise: "advertise",

  // Fetching assets.
  assets: "assets",

  // Calling services
  callServices: "callServices",

  // Setting speed to something that is not real time.
  setSpeed: "setSpeed",

  // Ability to play, pause, and seek in time.
  playbackControl: "playbackControl",

  // List and retrieve values for configuration key/value pairs
  getParameters: "getParameters",

  // Set values for configuration key/value pairs
  setParameters: "setParameters",
};
