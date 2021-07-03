// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

// This file is not used in the app, but exists to test that our eslint config catches the code we want it to catch.
// Because we run eslint with --report-unused-disable-directives, any unused comments will be errors.

/* eslint-disable @typescript-eslint/no-unused-expressions */

({
  // eslint-disable-next-line no-restricted-syntax
  get x() {
    return 1;
  },
  // @ts-expect-error unused variable
  // eslint-disable-next-line no-restricted-syntax
  set x(newX) {},
});

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
  null === wut; // eslint-disable-line no-restricted-syntax, @foxglove/strict-equality
  wut === null; // eslint-disable-line no-restricted-syntax, @foxglove/strict-equality

  wut == undefined;
  wut != undefined;
  undefined == wut;
  undefined != wut;
  undefined === wut; // eslint-disable-line @foxglove/strict-equality
  wut === undefined; // eslint-disable-line @foxglove/strict-equality

  wut == str; // eslint-disable-line @foxglove/strict-equality
  str == wut; // eslint-disable-line @foxglove/strict-equality
};

// @ts-expect-error unused function
function useEffectOnce() {} // eslint-disable-line id-denylist, @typescript-eslint/no-unused-vars

// keep isolatedModules happy
export default {};
