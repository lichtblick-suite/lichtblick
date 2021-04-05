# Vagrant

The purpose of this package is to allow you to run a complete graphical Ubuntu ROS 1+2 environment inside a VM, for testing on non-Linux platforms. It can be used with VirtualBox, Parallels, or other providers.

To get started:

```sh
$ vagrant up [--provider=parallels]     # Create and start the VM
$ vagrant ssh                           # SSH into the VM
$ vagrant reload                        # Restart the VM
$ vagrant destroy                       # Destroy the VM
```

The `--provider` flag is only needed the first time you create the machine. The default provider for Vagrant is VirtualBox.

- The VM is accessible at `192.168.33.10`.
- The default username is `vagrant` with password `vagrant`.
