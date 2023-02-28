// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import { MessageDefinition } from "@foxglove/message-definition";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";

// For one datatype in the datatypes, find the MessageDefinition that we can use
// to either write or parse it. `datatypes` should contain the root datatype and
// all complex sub-datatypes.
export default function rosDatatypesToMessageDefinition(
  datatypes: RosDatatypes,
  rootDatatypeName: string,
): MessageDefinition[] {
  const result = [];
  const seenDatatypeNames = new Set([rootDatatypeName]);
  // It doesn't matter if we use a stack or queue here, but we use a stack.
  const datatypeNameStack = [rootDatatypeName];

  while (datatypeNameStack.length > 0) {
    const currentDatatypeName = datatypeNameStack.pop();
    if (currentDatatypeName == undefined) {
      throw new Error(`Invariant violation - Array.pop() when length > 0`);
    }
    const currentDatatype = datatypes.get(currentDatatypeName);
    if (!currentDatatype) {
      throw new Error(
        `While searching datatypes for "${rootDatatypeName}", could not find datatype "${currentDatatypeName}"`,
      );
    }
    // The root datatype has no name field.
    const msgDefinition: MessageDefinition =
      currentDatatypeName === rootDatatypeName
        ? { definitions: currentDatatype.definitions }
        : { name: currentDatatypeName, definitions: currentDatatype.definitions };
    result.push(msgDefinition);
    for (const field of currentDatatype.definitions) {
      // Only search subfields if we haven't already seen it and it is "complex", IE it has its own fields and should
      // be contained in `datatypes`.
      if (field.isComplex === true && !seenDatatypeNames.has(field.type)) {
        datatypeNameStack.push(field.type);
        seenDatatypeNames.add(field.type);
      }
    }
  }

  return result;
}
