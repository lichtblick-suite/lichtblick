// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import type { XMLBuilder } from "xmlbuilder2/lib/interfaces";

export class CustomType {
  tagName = "customType";

  constructor(public raw: string) {}

  serialize(xml: XMLBuilder): XMLBuilder {
    return xml.ele(this.tagName).txt(this.raw);
  }
}
