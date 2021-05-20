# sensor_msgs/RelativeHumidity
# Single reading from a relative humidity sensor.  Defines the ratio of partial
# pressure of water vapor to the saturated vapor pressure at a temperature.

Header header             # timestamp of the measurement
                          # frame_id is the location of the humidity sensor

float64 relative_humidity # Expression of the relative humidity
                          # from 0.0 to 1.0.
                          # 0.0 is no partial pressure of water vapor
                          # 1.0 represents partial pressure of saturation

float64 variance          # 0 is interpreted as variance unknown

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
