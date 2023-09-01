// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

/**
 * Safari < 16.4 doesn't support `static{}` blocks in classes. TypeScript sometimes uses these when
 * emitting code for decorators.
 */
function supportsClassStaticInitialization() {
  try {
    // eslint-disable-next-line no-new-func, @typescript-eslint/no-implied-eval
    new Function("class X { static { } }");
    return true;
  } catch (err) {
    return false;
  }
}

/** Returns true if JS syntax and APIs required for rendering the rest of the app are supported. */
export function canRenderApp(): boolean {
  return (
    typeof BigInt64Array === "function" &&
    typeof BigUint64Array === "function" &&
    supportsClassStaticInitialization()
  );
}
