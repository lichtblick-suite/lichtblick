---
description: "Unit testing patterns, mock builder usage, and test data construction strategies for the Lichtblick monorepo."
---

# Unit Testing Skill

## Mock Builders (ADR-0002)

The project follows [ADR-0002: Reusable Mock Builders for Testing](https://github.com/lichtblick-suite/architectural-decision/blob/main/doc/adr/0002-mock-builders-for-testing.md) — a Builder pattern that centralizes test data creation across unit, integration, and E2E tests.

### Why Builders?

- **Reusability**: Same builders used in unit, integration, and E2E tests
- **Consistency**: All tests get valid, well-formed test data by default
- **Flexibility**: Override only the fields relevant to the test, rest auto-populated
- **Readability**: Tests focus on behavior, not data setup boilerplate

### Architecture

```
@lichtblick/test-builders          (external published npm dependency, not a workspace package)
├── BasicBuilder                    (primitives: string, number, boolean, date, lists, etc.)
└── defaults<T>(overrides, defaults) (utility to merge partial overrides with defaults)

@lichtblick/suite-base/testing/builders/  (domain builders)
├── PlayerBuilder.ts                (PlayerState, Topic, TopicStats, ActiveData)
├── MessageEventBuilder.ts          (MessageEvent with topic + data)
├── RosTimeBuilder.ts               (Time { sec, nsec })
├── RosDatatypesBuilder.ts          (MessageDefinition, datatypes maps)
├── LayoutBuilder.ts                (Layout configs, global variables)
├── RenderStateBuilder.ts           (Panel renderState)
├── ExtensionBuilder.ts             (Extension metadata)
├── PlotBuilder.ts                  (Plot panel data)
├── DiagnosticsBuilder.ts           (DiagnosticStatusArray)
├── SettingsTreeNodeBuilder.ts      (Settings tree nodes)
├── InitializationSourceBuilder.ts   (Data source initialization)
└── ... (more domain-specific builders)
```

### Usage Pattern

```typescript
import { BasicBuilder } from "@lichtblick/test-builders";
import PlayerBuilder from "@lichtblick/suite-base/testing/builders/PlayerBuilder";

// Create with all defaults — valid data without specifying anything
const topic = PlayerBuilder.topic();

// Override only what matters for this test
const customTopic = PlayerBuilder.topic({ name: "/camera/image" });

// Generate multiple instances
const topics = PlayerBuilder.topics(5);

// Compose builders for complex objects
const state = PlayerBuilder.playerState({
  activeData: PlayerBuilder.activeData({
    topics: [PlayerBuilder.topic({ name: "/lidar" })],
    currentTime: RosTimeBuilder.time({ sec: 100, nsec: 0 }),
  }),
});
```

### Creating a New Builder

Follow the existing pattern when adding builders for new domain types:

```typescript
import { BasicBuilder, defaults } from "@lichtblick/test-builders";

class MyEntityBuilder {
  // Static factory method with partial overrides
  public static myEntity(props: Partial<MyEntity> = {}): MyEntity {
    return defaults<MyEntity>(props, {
      id: BasicBuilder.string(),
      name: BasicBuilder.string(),
      count: BasicBuilder.number(),
      enabled: BasicBuilder.boolean(),
      createdAt: BasicBuilder.date(),
    });
  }

  // Plural helper for generating lists
  public static myEntities(count = 3): MyEntity[] {
    return BasicBuilder.multiple(MyEntityBuilder.myEntity, count);
  }
}

export default MyEntityBuilder;
```

### Key Principles

1. **Default values must produce valid objects** — a builder with no overrides should return a structurally correct instance
2. **Use `defaults<T>()` helper** — merges partial overrides with generated defaults
3. **Static methods only** — builders are stateless utility classes, no instances needed
4. **Compose builders** — entity builders call other builders for nested types (e.g., `PlayerBuilder` calls `RosTimeBuilder`)
5. **Place builders in correct scope**:
   - Shared primitives → `@lichtblick/test-builders` (`BasicBuilder`)
   - Domain entities → `@lichtblick/suite-base/testing/builders/`
   - Component-specific test data → colocated `builders/` directory within the component folder

### BasicBuilder API

The `BasicBuilder` class (from `@lichtblick/test-builders`) provides:

| Method | Returns |
|--------|---------|
| `BasicBuilder.string()` | Random string |
| `BasicBuilder.number()` | Random number |
| `BasicBuilder.boolean()` | Random boolean |
| `BasicBuilder.date()` | Random Date |
| `BasicBuilder.strings(count?)` | Array of strings |
| `BasicBuilder.sample(array, count?)` | Random sample from array |
| `BasicBuilder.multiple(factory, count?)` | Array of N items from factory function |
| `BasicBuilder.genericMap(valueFn)` | Map with generated keys/values |
| `BasicBuilder.genericDictionary(valueFn)` | Record<string, T> with generated entries |

### Anti-patterns

- **Don't inline test data** when a builder exists — use `PlayerBuilder.topic()` instead of `{ name: "/foo", schemaName: "bar" }`
- **Don't copy-paste** builder data between tests — extract to a builder method
- **Don't assert on random builder values** — override the specific field you're testing, then assert on that known value
- **Don't use builders to test the builder output** — test actual behavior

## Test Structure Reference

See the Unit Test Agent (`.github/agents/lb-unit-test.agent.md`) for:
- Given-When-Then (GWT) pattern
- Naming conventions
- Mocking patterns (modules, workers, timers)
- Test quality rules
