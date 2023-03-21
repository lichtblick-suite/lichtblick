// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

type ReportErrorHandler = (error: Error) => void;

const globalWithHandler = global as { foxgloveStudioReportErrorFn?: ReportErrorHandler };

/**
 * Report an error that has escaped past normal error-handling flows in the app and should be
 * triaged and diagnosed.
 */
export function reportError(error: Error): void {
  globalWithHandler.foxgloveStudioReportErrorFn?.(error);
}

/**
 * Set the handler function which will be called when an error is passed to `reportError()`. The default is
 * a no-op.
 */
export function setReportErrorHandler(fn: ReportErrorHandler): void {
  globalWithHandler.foxgloveStudioReportErrorFn = fn;
}
