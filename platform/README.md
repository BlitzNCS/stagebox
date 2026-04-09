# Platforms

CueTools is designed to run on different hardware platforms. Each platform directory contains the scripts and configuration needed to deploy CueTools on that specific hardware.

## Available Platforms

| Platform | Directory | Status | Description |
|---|---|---|---|
| **CueBoxx** (Raspberry Pi) | `cueboxx/` | Primary | The reference platform — a dedicated Pi-based appliance |

## How Platforms Work

The core CueTools software (in `/cuetools`) is platform-agnostic Node.js code. Platform directories provide:

- **Installation scripts** — automate setup on that hardware
- **Service definitions** — systemd units, init scripts, or boot hooks
- **Device configuration** — udev rules, boot config, display setup
- **Documentation** — platform-specific setup and usage guides

## Adding a New Platform

1. Create a directory under `platform/` named for your hardware
2. Include an installer script that copies CueTools and configures the system
3. Add service definitions appropriate for that OS/init system
4. Document any hardware-specific requirements

CueTools settings can be overridden via environment variables (see `cuetools/cuetools.js` header).
