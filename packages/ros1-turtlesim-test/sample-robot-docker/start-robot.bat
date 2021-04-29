cd /d "%~dp0"

set ROSCORE_PORT=11311
set MIN_PORT=11312
set MAX_PORT=11366
set HOSTNAME=%COMPUTERNAME%
set HOME=%HOMEDRIVE%%HOMEPATH%

docker build --tag sample-robot .

docker run ^
  -it ^
  --rm ^
  --sysctl net.ipv4.ip_local_port_range="%MIN_PORT% %MAX_PORT%" ^
  --hostname %HOSTNAME% ^
  -e ROS_MASTER_URI="http://%HOSTNAME%:%ROSCORE_PORT%/" ^
  -e ROS_HOSTNAME="%HOSTNAME%" ^
  -p %ROSCORE_PORT%-%MAX_PORT%:%ROSCORE_PORT%-%MAX_PORT% ^
  --name sample-robot ^
  sample-robot
