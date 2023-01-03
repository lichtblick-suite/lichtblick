// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// logger channel -> logger
const channels = new Map<string, Logger>();

const noop = () => {};

type LogLevel = "error" | "warn" | "info" | "debug";

class Logger {
  // default logger has an empty name
  public static default = new Logger("");

  private _name: string;

  // all new loggers are created from the default logger
  private constructor(name: string) {
    this._name = name;
    this.setLevel("debug");
    channels.set(name, this);
  }

  // fully qualified name for the logger
  public name(): string {
    return this._name;
  }

  /**
   * Return true if the level would display when logged by the logger
   */
  public isLevelOn(level: LogLevel): boolean {
    switch (level) {
      case "debug":
        return this.debug !== noop;
      case "info":
        return this.info !== noop;
      case "warn":
        return this.warn !== noop;
      case "error":
        return this.error !== noop;
    }
    return false;
  }

  /**
   *
   * @returns the current log level
   */
  public getLevel(): LogLevel {
    if (this.debug !== noop) {
      return "debug";
    } else if (this.info !== noop) {
      return "info";
    } else if (this.warn !== noop) {
      return "warn";
    } else {
      return "error";
    }
  }

  /**
   * Set the allowed log level. Any log calls with severity "below" this one will be ignored.
   *
   * i.e. setting a level of "warn" will ignore any "info" or "debug" logs
   */
  public setLevel(level: LogLevel): void {
    this.debug = noop;
    this.info = noop;
    this.warn = noop;
    this.error = noop;

    switch (level) {
      case "debug":
        this.debug = console.debug.bind(global.console);
        this.info = console.info.bind(global.console);
        this.warn = console.warn.bind(global.console);
        this.error = console.error.bind(global.console);
        break;
      case "info":
        this.info = console.info.bind(global.console);
        this.warn = console.warn.bind(global.console);
        this.error = console.error.bind(global.console);
        break;
      case "warn":
        this.warn = console.warn.bind(global.console);
        this.error = console.error.bind(global.console);
        break;
      case "error":
        this.error = console.error.bind(global.console);
        break;
    }
  }

  public debug(..._args: unknown[]): void {}
  public info(..._args: unknown[]): void {}
  public warn(..._args: unknown[]): void {}
  public error(..._args: unknown[]): void {}

  // create a new logger under this logger's namespace
  public getLogger(name: string): Logger {
    const shortName = name.replace(/^.+\.(asar|webpack)[\\/\\]/, "").replace(/^(\.\.\/)+/, "");
    const channelName = this._name.length > 0 ? `${this._name}.${shortName}` : shortName;
    const existing = channels.get(channelName);
    if (existing) {
      return existing;
    }

    const logger = new Logger(channelName);
    channels.set(channelName, logger);
    return logger;
  }

  // get all logging channels
  public channels(): Logger[] {
    return Array.from(channels.values());
  }
}

function toLogLevel(maybeLevel: string): LogLevel {
  switch (maybeLevel) {
    case "debug":
      return "debug";
    case "info":
      return "info";
    case "warn":
      return "warn";
    case "error":
      return "error";
    default:
      return "warn";
  }
}

export default Logger.default;
export { Logger, toLogLevel };
export type { LogLevel };
