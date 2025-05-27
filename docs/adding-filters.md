# Adding Filters in Lichtblick

This document explains how to use filters in Lichtblick to narrow down the data displayed in visualization panels.

## What are Filters?

Filters in Lichtblick allow you to refine the data displayed in visualization panels. By applying filters, you can:

- Focus on specific time ranges
- Show only messages that meet certain criteria
- Exclude irrelevant data
- Improve performance when working with large datasets

## Types of Filters

Lichtblick supports several types of filters:

### 1. Topic Filters

Topic filters allow you to select which topics to display in a panel. Each panel typically has a topic selector in its settings.

### 2. Message Path Filters

Message path filters allow you to filter based on specific fields within messages. For example, you could filter to show only messages where `sensor.temperature > 50`.

### 3. Time Range Filters

Time range filters limit the data to a specific time window, showing only messages that were published during that time.

## Adding a Filter to a Panel

### Step 1: Open Panel Settings

1. Click on the gear icon (⚙️) in the top-right corner of a panel
2. Navigate to the "Topics" or "Filter" tab, depending on the panel type

### Step 2: Add a Filter

For most panels, you can add a filter by:

1. Selecting the topic you want to filter
2. Clicking the "Add Filter" button
3. Selecting a field path (e.g., `pose.position.x`)
4. Choosing a comparison operator (e.g., `>`, `<`, `==`)
5. Entering a value to compare against
6. Clicking "Apply"

See our [detailed filter sequence diagram](./add-filter-sequence.md) for more information.

### Step 3: Test and Refine

1. Check if the filter works as expected
2. Adjust filter parameters if needed
3. Add additional filters for more complex filtering

## Filter Syntax

For advanced users, Lichtblick supports a query syntax for message path filters:

- Basic comparison: `message.field > 5`
- Logical operators: `message.field1 > 5 && message.field2 == "example"`
- Regular expressions: `message.field.match("pattern.*")`

## Examples

### Example 1: Filter Points by Distance

For a point cloud in a 3D panel:

1. Open the 3D panel settings
2. Select your point cloud topic
3. Add a filter with:
   - Field: `points[].x`
   - Operator: `<`
   - Value: `10`
4. This will only show points where the x-coordinate is less than 10

### Example 2: Filter by Message Content

For a Raw Messages panel:

1. Open the Raw Messages panel settings
2. Select your topic
3. Add a filter with:
   - Field: `data.status`
   - Operator: `==`
   - Value: `"ACTIVE"`
4. This will only show messages where the status field equals "ACTIVE"

### Example 3: Time-Based Filtering

To focus on events during a specific time period:

1. Open the panel settings
2. In the filter section, add:
   - Field: `header.stamp`
   - Operator: `between`
   - Value: `1620000000, 1620001000`
3. This will show only messages with timestamps in the specified range

## Filter Performance Tips

- Filters are applied as early as possible in the data processing pipeline for optimal performance
- More specific filters will generally improve performance
- When dealing with very large datasets, apply time range filters first
- Complex filters on large arrays can impact performance

## Next Steps

- See the [User Guide](./user-guide.md) for more detailed information on specific panel filters
- Check out the [API Documentation](./api/index.md) if you're developing custom panels with filter support
