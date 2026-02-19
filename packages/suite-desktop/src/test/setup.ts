// SPDX-FileCopyrightText: Copyright (C) 2023-2026 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

// intercept console.error and console.warn calls to fail tests if they are called
// the user can indicate they expect the call to happen by checking the mock.calls
// and then clearing the mock via mockClear()
//
// We assign rather than spy to expose the mock for the user
const origError = console.error;
const origWarn = console.warn;
const consoleErrorMock = (console.error = jest.fn());
const consoleWarnMock = (console.warn = jest.fn());

beforeEach(() => {
  consoleErrorMock.mockClear();
  consoleWarnMock.mockClear();
});

afterEach(() => {
  const calls = consoleErrorMock.mock.calls;

  if (calls.length > 0) {
    // show the user the error messages so they can track them down
    for (const call of calls) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      origError(...call);
    }
    throw new Error(
      `console.error was called in the test.\n\n
If this is expected, check the call values via console.error.mock.calls and
clear with console.error.mockClear()`,
    );
  }
});

afterEach(() => {
  const calls = consoleWarnMock.mock.calls;

  if (calls.length > 0) {
    // show the user the warnings so they can track them down
    for (const call of calls) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      origWarn(...call);
    }
    throw new Error(
      `console.warn was called in the test.\n\n
If this is expected, check the call values via console.warn.mock.calls and
clear with console.warn.mockClear()`,
    );
  }
});
