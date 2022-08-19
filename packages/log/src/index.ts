// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// logger channel -> logger
const channels = new Map<string, Logger>();

const noop = () => {};

class Logger {
  // default logger has an empty name
  public static default = new Logger("");

  private _name: string;
  private _enabled = true;

  // all new loggers are created from the default logger
  private constructor(name: string) {
    this._name = name;
    this._updateHandlers();

    channels.set(name, this);
  }

  // fully qualified name for the logger
  public name() {
    return this._name;
  }

  public isEnabled() {
    return this._enabled;
  }

  public enable() {
    this._enabled = true;
    this._updateHandlers();
  }

  public disable() {
    this._enabled = false;
    this._updateHandlers();
  }

  public debug(..._args: unknown[]) {}
  public info(..._args: unknown[]) {}
  public warn(..._args: unknown[]) {}
  public error(..._args: unknown[]) {}

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

  private _updateHandlers() {
    if (this._enabled) {
      const prefix = this._name.length > 0 ? `[${this._name}]` : "";
      this.debug = console.debug.bind(global.console, `${prefix}`);
      this.info = console.info.bind(global.console, `${prefix}`);
      this.warn = console.warn.bind(global.console, `${prefix}`);
      this.error = console.error.bind(global.console, `${prefix}`);
    } else {
      this.debug = noop;
      this.info = noop;
      this.warn = noop;
      this.error = noop;
    }
  }
}

export default Logger.default;
