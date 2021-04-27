// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// This file is not used in the app, but exists to test that our eslint config catches the code we want it to catch.
// Because we run eslint with --report-unused-disable-directives, any unused comments will be errors.

export {}; // for isolatedModules

({
  // eslint-disable-next-line no-restricted-syntax
  get x() {
    return 1;
  },
  // @ts-expect-error unused variable
  // eslint-disable-next-line no-restricted-syntax
  set x(newX) {},
});

void (async () => {
  await 1; // eslint-disable-line @typescript-eslint/await-thenable
  await (function () {})(); // eslint-disable-line @typescript-eslint/await-thenable
  await (async function () {})();
})();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(str: string, num: number, wut: any) => {
  str ? 0 : 1; // eslint-disable-line @typescript-eslint/strict-boolean-expressions
  num ? 0 : 1; // eslint-disable-line @typescript-eslint/strict-boolean-expressions
  wut ? 0 : 1; // no error for now

  console.log = () => 0;
  console.log(str); // eslint-disable-line no-restricted-syntax

  // All nulls are banned
  wut == null; // eslint-disable-line no-restricted-syntax
  wut != null; // eslint-disable-line no-restricted-syntax
  null == wut; // eslint-disable-line no-restricted-syntax
  null != wut; // eslint-disable-line no-restricted-syntax
  null === wut; // eslint-disable-line no-restricted-syntax
  wut === null; // eslint-disable-line no-restricted-syntax

  wut == undefined;
  wut != undefined;
  undefined == wut; // eslint-disable-line no-restricted-syntax
  undefined != wut; // eslint-disable-line no-restricted-syntax
  undefined === wut;
  wut === undefined;

  wut == str; // eslint-disable-line no-restricted-syntax
  str == wut; // eslint-disable-line no-restricted-syntax
};

// @ts-expect-error unused function
function useEffectOnce() {} // eslint-disable-line id-denylist, @typescript-eslint/no-unused-vars
