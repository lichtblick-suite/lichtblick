// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

export class XmlRpcFault extends Error {
  code?: number;
  faultCode?: number;
  faultString?: string;

  constructor(faultString?: string, faultCode?: number) {
    const msg = `XML-RPC fault${faultString != undefined ? ": " + faultString : ""}`;
    super(msg);

    this.code = this.faultCode = faultCode;
    this.faultString = faultString;
  }
}
