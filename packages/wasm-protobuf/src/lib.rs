use wasm_bindgen::prelude::*;
use prost::Message;
use prost_reflect::{DescriptorPool, DynamicMessage, Kind, MessageDescriptor, SerializeOptions};
use prost_types::FileDescriptorSet;
use serde::Serialize;

#[wasm_bindgen]
pub struct ProtobufDecoder {
    pool: DescriptorPool,
    message_name: String,
}

#[wasm_bindgen]
impl ProtobufDecoder {
    #[wasm_bindgen(constructor)]
    pub fn new(schema_data: &[u8], message_name: String) -> Result<ProtobufDecoder, JsValue> {
        // Decode the FileDescriptorSet
        let file_descriptor_set = FileDescriptorSet::decode(schema_data)
            .map_err(|e| JsValue::from_str(&format!("Failed to decode FileDescriptorSet: {}", e)))?;

        // Build descriptor pool
        let pool = DescriptorPool::from_file_descriptor_set(file_descriptor_set)
            .map_err(|e| JsValue::from_str(&format!("Failed to build descriptor pool: {}", e)))?;

        Ok(ProtobufDecoder {
            pool,
            message_name,
        })
    }

    pub fn decode(&self, data: &[u8]) -> Result<JsValue, JsValue> {
        // Get the message descriptor
        let message_descriptor = self.pool
            .get_message_by_name(&self.message_name)
            .ok_or_else(|| JsValue::from_str(&format!("Message type '{}' not found in schema", self.message_name)))?;

        // Decode the message dynamically
        let dynamic_message = DynamicMessage::decode(message_descriptor.clone(), data)
            .map_err(|e| JsValue::from_str(&format!("Failed to decode message: {}", e)))?;

        // Serialize to a JSON value, fill missing descriptor fields as null, then convert once to JsValue.
        // This avoids expensive per-field JS object construction across the WASM boundary.
        let serialize_opts = SerializeOptions::new()
            .skip_default_fields(false)
            .use_proto_field_name(true)
            .use_enum_numbers(true)
            .stringify_64_bit_integers(false);

        let mut json_value = dynamic_message
            .serialize_with_options(serde_json::value::Serializer, &serialize_opts)
            .map_err(|e| JsValue::from_str(&format!("Failed to serialize message: {}", e)))?;

        fill_missing_fields(&mut json_value, &message_descriptor);
        coerce_json_types(&mut json_value, &message_descriptor);

        let serializer = serde_wasm_bindgen::Serializer::new()
            .serialize_maps_as_objects(true)
            .serialize_missing_as_null(true)
            .serialize_large_number_types_as_bigints(true);

        json_value
            .serialize(&serializer)
            .map_err(|e| JsValue::from_str(&format!("Failed to convert to JsValue: {}", e)))
    }

    // Decode many messages in one JS->WASM call.
    //
    // `data_blob` is a concatenation of message bytes.
    // `offsets` is length N+1: offsets[i]..offsets[i+1] is message i.
    // pub fn decode_batch(&self, data_blob: &[u8], offsets: &[u32]) -> Result<JsValue, JsValue> {
    //     if offsets.len() < 2 {
    //         return Ok(Array::new().into());
    //     }

    //     // Resolve descriptor once (big win vs doing it per message)
    //     let message_descriptor: MessageDescriptor = self.pool
    //         .get_message_by_name(&self.message_name)
    //         .ok_or_else(|| JsValue::from_str(&format!("Message type '{}' not found in schema", self.message_name)))?;

    //     let serialize_opts = SerializeOptions::new()
    //         .skip_default_fields(false)
    //         .use_proto_field_name(true)
    //         .use_enum_numbers(true)
    //         .stringify_64_bit_integers(false);

    //     let serializer = serde_wasm_bindgen::Serializer::new()
    //         .serialize_maps_as_objects(true)
    //         .serialize_missing_as_null(true)
    //         .serialize_large_number_types_as_bigints(true);

    //     let out = Array::new();

    //     // offsets must be monotonically increasing and within bounds
    //     let total_len = data_blob.len();
    //     for win in offsets.windows(2) {
    //         let start = win[0] as usize;
    //         let end = win[1] as usize;

    //         if start > end || end > total_len {
    //             return Err(JsValue::from_str("Invalid offsets for decode_batch"));
    //         }

    //         let msg_bytes = &data_blob[start..end];

    //         let dynamic_message = DynamicMessage::decode(message_descriptor.clone(), msg_bytes)
    //             .map_err(|e| JsValue::from_str(&format!("Failed to decode message: {}", e)))?;

    //         let mut json_value = dynamic_message
    //             .serialize_with_options(serde_json::value::Serializer, &serialize_opts)
    //             .map_err(|e| JsValue::from_str(&format!("Failed to serialize message: {}", e)))?;

    //         // Keep your current semantics (snake_case, include null keys, bigint coercion)
    //         fill_missing_fields(&mut json_value, &message_descriptor);
    //         coerce_json_types(&mut json_value, &message_descriptor);

    //         let js_value = json_value
    //             .serialize(&serializer)
    //             .map_err(|e| JsValue::from_str(&format!("Failed to convert to JsValue: {}", e)))?;

    //         out.push(&js_value);
    //     }

    //     Ok(out.into())
    // }
}

fn fill_missing_fields(value: &mut serde_json::Value, descriptor: &MessageDescriptor) {
    let serde_json::Value::Object(obj) = value else {
        return;
    };

    for field in descriptor.fields() {
        let field_name = field.name();
        let entry = obj
            .entry(field_name.to_string())
            .or_insert(serde_json::Value::Null);

        // Only recurse into nested message objects that are actually present.
        // If the field is absent, we intentionally keep it as null (matches protobufjs defaults behavior).
        if entry.is_null() {
            continue;
        }

        let Kind::Message(message_descriptor) = field.kind() else {
            continue;
        };

        // Maps serialize as plain JSON objects (key -> value) rather than map_entry messages.
        // Do not treat them as nested messages.
        if message_descriptor.is_map_entry() {
            continue;
        }

        match entry {
            serde_json::Value::Object(_) => fill_missing_fields(entry, &message_descriptor),
            serde_json::Value::Array(items) => {
                for item in items {
                    fill_missing_fields(item, &message_descriptor);
                }
            }
            _ => {}
        }
    }
}

fn coerce_json_types(value: &mut serde_json::Value, descriptor: &MessageDescriptor) {
    let serde_json::Value::Object(obj) = value else {
        return;
    };

    for field in descriptor.fields() {
        let field_name = field.name();
        let Some(entry) = obj.get_mut(field_name) else {
            continue;
        };
        if entry.is_null() {
            continue;
        }

        // Repeated fields serialize as arrays.
        if let serde_json::Value::Array(items) = entry {
            for item in items {
                coerce_json_value_for_kind(item, &field.kind());
            }
            continue;
        }

        coerce_json_value_for_kind(entry, &field.kind());
    }
}

fn coerce_json_value_for_kind(value: &mut serde_json::Value, kind: &Kind) {
    match kind {
        // Keep i64/u64 as integers so serde-wasm-bindgen can emit JS BigInt.
        Kind::Int64 | Kind::Sint64 | Kind::Sfixed64 | Kind::Uint64 | Kind::Fixed64 => {}

        // serde_json loses integer width, so i32/u32 often become i64 and then would be converted
        // to JS BigInt. Force these to be represented as f64 so they become JS Number.
        Kind::Int32
        | Kind::Sint32
        | Kind::Sfixed32
        | Kind::Uint32
        | Kind::Fixed32
        | Kind::Enum(_) => {
            if let serde_json::Value::Number(n) = value {
                // Only coerce integer-ish numbers; leave floats alone.
                if let Some(i) = n.as_i64() {
                    if let Some(f) = serde_json::Number::from_f64(i as f64) {
                        *value = serde_json::Value::Number(f);
                    }
                } else if let Some(u) = n.as_u64() {
                    if let Some(f) = serde_json::Number::from_f64(u as f64) {
                        *value = serde_json::Value::Number(f);
                    }
                }
            }
        }

        Kind::Message(message_descriptor) => {
            if message_descriptor.is_map_entry() {
                let serde_json::Value::Object(obj) = value else {
                    return;
                };

                // Map JSON representation is { key: value, ... }. Apply coercion to each value.
                let value_field_kind = message_descriptor
                    .fields()
                    .find(|f| f.name() == "value")
                    .map(|f| f.kind());

                if let Some(value_kind) = value_field_kind {
                    for map_value in obj.values_mut() {
                        // Map values are not arrays at this level; if they are, treat them as repeated.
                        if let serde_json::Value::Array(items) = map_value {
                            for item in items {
                                coerce_json_value_for_kind(item, &value_kind);
                            }
                        } else {
                            coerce_json_value_for_kind(map_value, &value_kind);
                        }
                    }
                }

                return;
            }

            match value {
                serde_json::Value::Object(_) => coerce_json_types(value, message_descriptor),
                serde_json::Value::Array(items) => {
                    for item in items {
                        if let serde_json::Value::Object(_) = item {
                            coerce_json_types(item, message_descriptor);
                        }
                    }
                }
                _ => {}
            }
        }

        _ => {}
    }
}

// Keep a simple function for testing
#[wasm_bindgen]
pub fn decode_protobuf_simple(schema_data: &[u8], message_name: String, data: &[u8]) -> Result<JsValue, JsValue> {
    let decoder = ProtobufDecoder::new(schema_data, message_name)?;
    decoder.decode(data)
}
