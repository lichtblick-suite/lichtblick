## Data Loading Sequence in Lichtblick

```
┌─────┐          ┌──────────────┐          ┌──────────┐          ┌───────┐
│User │          │      App     │          │DataSource│          │ Panel │
└──┬──┘          └──────┬───────┘          └────┬─────┘          └───┬───┘
   │                    │                       │                    │
   │ Open Data Source   │                       │                    │
   │───────────────────>│                       │                    │
   │                    │                       │                    │
   │                    │ initialize()          │                    │
   │                    │──────────────────────>│                    │
   │                    │                       │                    │
   │                    │      initialized      │                    │
   │                    │<──────────────────────│                    │
   │                    │                       │                    │
   │ Select Layout      │                       │                    │
   │───────────────────>│                       │                    │
   │                    │                       │                    │
   │                    │                       │   initialize()     │
   │                    │───────────────────────────────────────────>│
   │                    │                       │                    │
   │                    │                       │  subscribe(topics) │
   │                    │                       │<───────────────────│
   │                    │                       │                    │
   │                    │                       │   subscription     │
   │                    │                       │───────────────────>│
   │                    │                       │                    │
   │                    │                       │─┐                  │
   │                    │                       │ │ For each message │
   │                    │                       │<┘                  │
   │                    │                       │                    │
   │                    │                       │ onMessage(message) │
   │                    │                       │───────────────────>│
   │                    │                       │                    │
   │                    │                       │                    │─┐
   │                    │                       │                    │ │ update
   │                    │                       │                    │<┘ visualization
   │                    │                       │                    │
   │ Change Settings    │                       │                    │
   │───────────────────────────────────────────────────────────────>│
   │                    │                       │                    │
   │                    │                       │                    │─┐
   │                    │                       │                    │ │ onSettingsChange()
   │                    │                       │                    │<┘
   │                    │                       │                    │
   │                    │                       │                    │─┐
   │                    │                       │                    │ │ update
   │                    │                       │                    │<┘ visualization
   │                    │                       │                    │
```

The sequence above illustrates how data flows through Lichtblick:

1. User opens a data source in the application
2. The app initializes the data source
3. When the user selects a layout, panels are initialized
4. Panels subscribe to relevant topics from the data source
5. The data source sends messages to subscribed panels
6. Panels update their visualizations based on the messages
7. When the user changes panel settings, the panel updates its visualization
