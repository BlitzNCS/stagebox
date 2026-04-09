# Extensions

Extensions adapt CueTools to run on hardware other than the primary CueBoxx (Raspberry Pi) platform. Each extension provides the platform-specific glue needed to bridge CueTools to that hardware.

## Available Extensions

| Extension | Directory | Description |
|---|---|---|
| **Pixel 8 Pro** | `pixel8-pro/` | Rooted Android phone running VolksPC Debian chroot |

## How Extensions Differ from Platforms

- **Platforms** (`/platform`) are first-class supported targets designed for direct deployment. CueBoxx on Raspberry Pi is the reference platform.
- **Extensions** (`/extensions`) adapt CueTools to non-standard or repurposed hardware. They may require more manual setup, workarounds, or have known limitations.

## Creating an Extension

1. Create a directory under `extensions/` named for your hardware
2. Provide any boot scripts, init hooks, or device setup needed
3. Include a deploy script if the deployment process is non-trivial
4. Document the hardware requirements and any known limitations
5. Reference the core CueTools code — don't fork or duplicate it
