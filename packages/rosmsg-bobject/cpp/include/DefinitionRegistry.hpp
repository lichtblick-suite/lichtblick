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

#pragma once

#include <memory>
#include <string>
#include <unordered_map>

namespace cruise {

class Definition;

class DefinitionRegistry {
public:
    DefinitionRegistry() noexcept;
    DefinitionRegistry(const DefinitionRegistry&) = delete;
    DefinitionRegistry(DefinitionRegistry&&) = delete;
    ~DefinitionRegistry() noexcept = default;

    DefinitionRegistry& operator=(const DefinitionRegistry&) = delete;
    DefinitionRegistry& operator=(const DefinitionRegistry&&) = delete;

    Definition* createDefinition(const std::string& name) noexcept;
    Definition* getDefinition(const std::string& name) noexcept;
    bool finalizeAll() noexcept;

private:
    using Registry = std::unordered_map<std::string, std::unique_ptr<Definition>>;
    Registry _definitions;
};

}  // namespace cruise
