## Adding a Filter in Lichtblick

```
┌─────┐          ┌───────┐          ┌─────────┐          ┌──────────────┐          ┌──────┐
│User │          │ Panel │          │ Filter  │          │ DataSource   │          │Cache │
└──┬──┘          └───┬───┘          └────┬────┘          └──────┬───────┘          └──┬───┘
   │                 │                    │                      │                    │
   │ Open Settings   │                    │                      │                    │
   │────────────────>│                    │                      │                    │
   │                 │                    │                      │                    │
   │                 │ Display Settings   │                      │                    │
   │<────────────────│                    │                      │                    │
   │                 │                    │                      │                    │
   │ Add Filter      │                    │                      │                    │
   │────────────────>│                    │                      │                    │
   │                 │                    │                      │                    │
   │                 │ Create Filter      │                      │                    │
   │                 │───────────────────>│                      │                    │
   │                 │                    │                      │                    │
   │ Set Parameters  │                    │                      │                    │
   │─────────────────────────────────────>│                      │                    │
   │                 │                    │                      │                    │
   │                 │                    │─┐                    │                    │
   │                 │                    │ │ Validate           │                    │
   │                 │                    │<┘ Parameters         │                    │
   │                 │                    │                      │                    │
   │                 │                    │ Register Filter      │                    │
   │                 │                    │─────────────────────>│                    │
   │                 │                    │                      │                    │
   │                 │                    │                      │ Apply Filter       │
   │                 │                    │                      │───────────────────>│
   │                 │                    │                      │                    │
   │                 │                    │                      │                    │
   │                 │                    │                      │     Filtered Data  │
   │                 │<─────────────────────────────────────────────────────────────-│
   │                 │                    │                      │                    │
   │                 │─┐                  │                      │                    │
   │                 │ │ Update           │                      │                    │
   │                 │<┘ Visualization    │                      │                    │
   │                 │                    │                      │                    │
```

The sequence above illustrates how filters are added in Lichtblick:

1. User opens the panel settings
2. The panel displays the settings interface
3. User adds a new filter
4. The panel creates a filter component
5. User sets filter parameters
6. The filter validates the parameters
7. The filter is registered with the data source
8. The data source applies the filter to its message cache
9. Filtered data is sent to the panel
10. The panel updates its visualization with the filtered data
