// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/** Suppress warnings about messages on unknown subscriptions if the susbscription was recently canceled. */
export const SUBSCRIPTION_WARNING_SUPPRESSION_MS = 2000;

export const ZERO_TIME = Object.freeze({ sec: 0, nsec: 0 });
export const GET_ALL_PARAMS_REQUEST_ID = "get-all-params";
export const GET_ALL_PARAMS_PERIOD_MS = 15000;
export const ROS_ENCODINGS = ["ros1", "cdr"];
export const SUPPORTED_PUBLICATION_ENCODINGS = ["json", ...ROS_ENCODINGS];
export const FALLBACK_PUBLICATION_ENCODING = "json";
export const SUPPORTED_SERVICE_ENCODINGS = ["json", ...ROS_ENCODINGS];

/**
 * When the tab is inactive setTimeout's are throttled to at most once per second.
 * Because the MessagePipeline listener uses timeouts to resolve its promises, it throttles our ability to
 * emit a frame more than once per second. In the websocket player this was causing
 * an accumulation of messages that were waiting to be emitted, this could keep growing
 * indefinitely if the rate at which we emit a frame is low enough.
 * 400MB
 */
export const CURRENT_FRAME_MAXIMUM_SIZE_BYTES = 400 * 1024 * 1024;
