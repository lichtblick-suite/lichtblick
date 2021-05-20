# sensor_msgs/MagneticField
# Measurement of the Magnetic Field vector at a specific location.

# If the covariance of the measurement is known, it should be filled in
# (if all you know is the variance of each measurement, e.g. from the datasheet,
#just put those along the diagonal)
# A covariance matrix of all zeros will be interpreted as "covariance unknown",
# and to use the data a covariance will have to be assumed or gotten from some
# other source


Header header                        # timestamp is the time the
                                     # field was measured
                                     # frame_id is the location and orientation
                                     # of the field measurement

geometry_msgs/Vector3 magnetic_field # x, y, and z components of the
                                     # field vector in Tesla
                                     # If your sensor does not output 3 axes,
                                     # put NaNs in the components not reported.

float64[9] magnetic_field_covariance # Row major about x, y, z axes
                                     # 0 is interpreted as variance unknown

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

================================================================================
MSG: geometry_msgs/Vector3
# This represents a vector in free space.
# It is only meant to represent a direction. Therefore, it does not
# make sense to apply a translation to it (e.g., when applying a
# generic rigid transformation to a Vector3, tf2 will only apply the
# rotation). If you want your data to be translatable too, use the
# geometry_msgs/Point message instead.

float64 x
float64 y
float64 z
