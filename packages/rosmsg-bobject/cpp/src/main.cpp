// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2020-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

#include "Definition.hpp"
#include "DefinitionRegistry.hpp"
#include "MessageWriter.hpp"

#if defined(__EMSCRIPTEN__)
#include <emscripten/bind.h>
#include <emscripten/val.h>
#endif

#include <cstddef>
#include <iostream>

#if defined(__EMSCRIPTEN__)

EMSCRIPTEN_BINDINGS(cruise) {
    emscripten::register_vector<int>("IntVector");

    emscripten::class_<cruise::Definition>("Definition")
            .function("getName", &cruise::Definition::getName)
            .function("getCommands", &cruise::Definition::flattenCommands)
            .function("getSize", &cruise::Definition::getSize)
            .function("addField", &cruise::Definition::addField);

    emscripten::class_<cruise::DefinitionRegistry>("DefinitionRegistry")
            .constructor()
            .function(
                    "create",
                    &cruise::DefinitionRegistry::createDefinition,
                    emscripten::allow_raw_pointers())
            .function(
                    "get",
                    &cruise::DefinitionRegistry::getDefinition,
                    emscripten::allow_raw_pointers())
            .function("finalize", &cruise::DefinitionRegistry::finalizeAll);

    emscripten::class_<cruise::MessageWriter>("MessageWriter")
            .constructor()
            .function("reserve", &cruise::MessageWriter::reserve, emscripten::allow_raw_pointers())
            .function("write", &cruise::MessageWriter::write, emscripten::allow_raw_pointers())
            .function("getBuffer", &cruise::MessageWriter::getDataBufferJS)
            .function("getBigString", &cruise::MessageWriter::getStringBufferJS);
}

#endif