# Message path syntax

Message path syntax is used throughout Studio to help you drill down to the exact information you want to inspect in your data.

## Topic

- `/some/topic`

## Nested values

- `/some_topic.some_value`
- `/some_topic.some_value.some_nested_value`

## Slices

- Single element
  - `/some_topic.many_values[0]`
  - `/some_topic.many_values[1].width`
  - `/some_topic.many_values[-1]`
- Ranges
  - `/some_topic.many_values[1:3].x`
  - `/some_topic.many_values[:].x`
  - `/some_topic.many_values[-2:-1]`
  - `/some_topic.many_values[$my_start_idx:$my_end_idx]`
- With variables
  - `/some_topic.many_values[$my_start_idx:$my_end_idx]`

## Filters

- Top-level topic
  - `/some_topic{foo.bar==123}`
- Nested values
  - `/some_topic.many_values[:]{id==123}.x`
- With variables
  - `/some_topic.many_values[:]{id==$my_id}`
- Multiple filters
  - `/some_topic.many_values[:]{some_str_field=="abc"}{some_num_field==5}{some_boolean_field==false}.x`

[Learn more](https://foxglove.dev/docs/app-concepts/message-path-syntax).
