// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

/**
 * Lightweight timezone data to replace moment-timezone's 160KB latest.json
 * This file contains commonly used timezones to keep bundle size small
 */

// Get system timezone using native Intl API
export function getSystemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

// Common timezones list - covers most use cases
export const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Mexico_City",
  "America/Sao_Paulo",
  "America/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "Europe/Brussels",
  "Europe/Vienna",
  "Europe/Stockholm",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Hong_Kong",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "Asia/Bangkok",
  "Asia/Jakarta",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Perth",
  "Pacific/Auckland",
];

// Format timezone offset (e.g., "+05:30", "-08:00")
export function formatTimezoneOffset(date: Date, timeZone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "longOffset",
    });
    const parts = formatter.formatToParts(date);
    const value = parts.find((part) => part.type === "timeZoneName")?.value;
    if (value != undefined && value.startsWith("GMT")) {
      return value.replace("GMT", "");
    }
  } catch {
    // Fallback
  }
  return "+00:00";
}

// Get timezone abbreviation (e.g., "PST", "CET")
export function getTimezoneAbbreviation(date: Date, timeZone: string): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    });
    const parts = formatter.formatToParts(date);
    const timeZonePart = parts.find((part) => part.type === "timeZoneName");
    return timeZonePart?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

// Format timezone display string (e.g., "America/New_York (EST, -05:00)")
export function formatTimezone(timeZone: string): string {
  try {
    const now = new Date();
    const abbr = getTimezoneAbbreviation(now, timeZone);
    const offset = formatTimezoneOffset(now, timeZone);

    if (timeZone === abbr) {
      return `${abbr} (${offset})`;
    }
    return `${timeZone} (${abbr}, ${offset})`;
  } catch {
    return timeZone;
  }
}

// Get all available timezone names (uses Intl API + common list)
export function getAllTimezoneNames(): string[] {
  // Try to get from Intl API (modern browsers support this)
  try {
    if (typeof Intl.supportedValuesOf === "function") {
      return Intl.supportedValuesOf("timeZone");
    }
  } catch {
    // Fallback to common timezones
  }

  return COMMON_TIMEZONES;
}
