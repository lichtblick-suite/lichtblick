# sensor_msgs/Illuminance
# Single photometric illuminance measurement.  Light should be assumed to be
# measured along the sensor's x-axis (the area of detection is the y-z plane).
# The illuminance should have a 0 or positive value and be received with
# the sensor's +X axis pointing toward the light source.

# Photometric illuminance is the measure of the human eye's sensitivity of the
# intensity of light encountering or passing through a surface.

# All other Photometric and Radiometric measurements should
# not use this message.
# This message cannot represent:
# Luminous intensity (candela/light source output)
# Luminance (nits/light output per area)
# Irradiance (watt/area), etc.

Header header           # timestamp is the time the illuminance was measured
                        # frame_id is the location and direction of the reading

float64 illuminance     # Measurement of the Photometric Illuminance in Lux.

float64 variance        # 0 is interpreted as variance unknown

================================================================================
MSG: std_msgs/Header
# Standard metadata for higher-level stamped data types.
# This is generally used to communicate timestamped data
# in a particular coordinate frame.
#
# sequence ID: consecutively increasing ID
uint32 seq
#Two-integer timestamp that is expressed as:
# * stamp.sec: seconds (stamp_secs) since epoch (in Python the variable is called 'secs')
# * stamp.nsec: nanoseconds since stamp_secs (in Python the variable is called 'nsecs')
# time-handling sugar is provided by the client library
time stamp
#Frame this data is associated with
string frame_id
