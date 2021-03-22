// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export type DateFormatterOptions = {
  colons?: boolean;
  hyphens?: boolean;
  ms?: boolean;
};

export class DateFormatter {
  #colons = true;
  #hyphens = true;
  #ms = true;

  // Regular Expression that dissects an ISO 8601 formatted string into an array of parts
  static ISO8601 = /([0-9]{4})([-]?([0-9]{2}))([-]?([0-9]{2}))(T-?([0-9]{2})(((:?([0-9]{2}))?((:?([0-9]{2}))?(\.([0-9]+))?))?)(Z|([+-]([0-9]{2}(:?([0-9]{2}))?)))?)?/;

  constructor(options?: DateFormatterOptions) {
    if (options) {
      this.#colons = options.colons ?? this.#colons;
      this.#hyphens = options.hyphens ?? this.#hyphens;
      this.#ms = options.ms ?? this.#ms;
    }
  }

  /**
   * Converts a date time stamp following the ISO8601 format to a JavaScript Date
   * object.
   *
   * @param {string} time - String representation of timestamp.
   * @return {Date}       - Date object from timestamp.
   */
  decodeIso8601(time: string): Date {
    const dateParts = time.toString().match(DateFormatter.ISO8601);
    if (!dateParts) {
      throw new Error(`Expected a ISO8601 datetime but got "${time}"`);
    }

    let date = [
      [dateParts[1], dateParts[3] ?? "01", dateParts[5] ?? "01"].join("-"),
      "T",
      [dateParts[7] ?? "00", dateParts[11] ?? "00", dateParts[14] ?? "00"].join(":"),
      ".",
      dateParts[16] ?? "000",
    ].join("");

    date +=
      dateParts[17] !== undefined
        ? dateParts[17] + (dateParts[19] != undefined && dateParts[20] == undefined ? "00" : "")
        : ["Z"];

    return new Date(date);
  }

  /**
   * Converts a JavaScript Date object to an ISO8601 timestamp.
   *
   * @param {Date} date - Date object.
   * @return {string}   - String representation of timestamp.
   */
  encodeIso8601(date: Date): string {
    const parts = DateFormatter.getUTCDateParts(date);

    return [
      [parts[0], parts[1], parts[2]].join(this.#hyphens ? "-" : ""),
      "T",
      [parts[3], parts[4], parts[5]].join(this.#colons ? ":" : ""),
      this.#ms ? "." + parts[6] : "",
      "Z",
    ].join("");
  }

  /**
   * Helper function to get the current timezone to default decoding to
   * rather than UTC. (for backward compatibility)
   *
   * @return {string} - in the format /Z|[+-]\d{2}:\d{2}/
   */
  static formatCurrentOffset(d?: Date): string {
    const offset = (d ?? new Date()).getTimezoneOffset();
    return offset === 0
      ? "Z"
      : [
          offset < 0 ? "+" : "-",
          DateFormatter.zeroPad(Math.abs(Math.floor(offset / 60)), 2),
          ":",
          DateFormatter.zeroPad(Math.abs(offset % 60), 2),
        ].join("");
  }

  /**
   * Helper function to pad the digits with 0s to meet date formatting
   * requirements.
   *
   * @param {number} digit  - The number to pad.
   * @param {number} length - Length of digit string, prefix with 0s if not
   *                          already length.
   * @return {string}       - String with the padded digit
   */
  static zeroPad(digit: number, length: number): string {
    let padded = "" + digit;
    while (padded.length < length) {
      padded = "0" + padded;
    }
    return padded;
  }

  /**
   * Helper function to get an array of zero-padded date parts,
   * in UTC
   *
   * @param {Date} date - Date Object
   * @return {string[]}
   */
  static getUTCDateParts(date: Date): string[] {
    return [
      date.getUTCFullYear().toString(),
      DateFormatter.zeroPad(date.getUTCMonth() + 1, 2),
      DateFormatter.zeroPad(date.getUTCDate(), 2),
      DateFormatter.zeroPad(date.getUTCHours(), 2),
      DateFormatter.zeroPad(date.getUTCMinutes(), 2),
      DateFormatter.zeroPad(date.getUTCSeconds(), 2),
      DateFormatter.zeroPad(date.getUTCMilliseconds(), 3),
    ];
  }
}
