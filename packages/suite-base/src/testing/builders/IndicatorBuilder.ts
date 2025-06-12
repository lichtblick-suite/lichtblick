// SPDX-FileCopyrightText: Copyright (C) 2023-2025 Bayerische Motoren Werke Aktiengesellschaft (BMW AG)<lichtblick@bmwgroup.com>
// SPDX-License-Identifier: MPL-2.0

import {
  IndicatorConfig,
  IndicatorRule,
  IndicatorStyle,
  IndicatorOperator,
} from "@lichtblick/suite-base/panels/Indicator/types";
import BasicBuilder from "@lichtblick/suite-base/testing/builders/BasicBuilder";
import { defaults } from "@lichtblick/suite-base/testing/builders/utilities";

export default class IndicatorBuilder {
  public static style(): IndicatorStyle {
    return BasicBuilder.sample(["bulb", "background"]);
  }

  public static operator(): IndicatorOperator {
    return BasicBuilder.sample(["=", "<", "<=", ">", ">="]);
  }

  public static rule(props: Partial<IndicatorRule> = {}): IndicatorRule {
    return defaults<IndicatorRule>(props, {
      color: BasicBuilder.string(),
      label: BasicBuilder.string(),
      operator: IndicatorBuilder.operator(),
      rawValue: BasicBuilder.string(),
    });
  }

  public static rules(count = 3): IndicatorRule[] {
    return BasicBuilder.multiple(IndicatorBuilder.rule, count);
  }

  public static config(props: Partial<IndicatorConfig> = {}): IndicatorConfig {
    return defaults<IndicatorConfig>(props, {
      fallbackColor: BasicBuilder.string(),
      fallbackLabel: BasicBuilder.string(),
      path: BasicBuilder.string(),
      rules: IndicatorBuilder.rules(),
      style: IndicatorBuilder.style(),
    });
  }
}
