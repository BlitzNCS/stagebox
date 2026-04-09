const { execSync, spawnSync } = require('child_process');
const os = require('os');

// Find ADB binary — checks PATH and common install locations
function findAdb() {
  // Try PATH first
  try {
    const cmd = os.platform() === 'win32' ? 'where adb' : 'which adb';
    return execSync(cmd, { encoding: 'utf-8' }).trim().split('\n')[0];
  } catch {}

  // Common locations
  const locations = os.platform() === 'win32'
    ? [
        `${process.env.LOCALAPPDATA}\\Android\\Sdk\\platform-tools\\adb.exe`,
        `${process.env.USERPROFILE}\\AppData\\Local\\Android\\Sdk\\platform-tools\\adb.exe`,
        'C:\\platform-tools\\adb.exe'
      ]
    : os.platform() === 'darwin'
    ? [
        `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`,
        '/usr/local/bin/adb',
        '/opt/homebrew/bin/adb'
      ]
    : [
        `${process.env.HOME}/Android/Sdk/platform-tools/adb`,
        '/usr/bin/adb',
        '/usr/local/bin/adb'
      ];

  const fs = require('fs');
  for (const loc of locations) {
    if (fs.existsSync(loc)) return loc;
  }

  return null;
}

// Find fastboot binary (same directory as ADB usually)
function findFastboot() {
  try {
    const cmd = os.platform() === 'win32' ? 'where fastboot' : 'which fastboot';
    return execSync(cmd, { encoding: 'utf-8' }).trim().split('\n')[0];
  } catch {}
  return null;
}

// Run an ADB command, return { ok, stdout, stderr }
function adb(adbPath, args, opts = {}) {
  const result = spawnSync(adbPath, args, {
    encoding: 'utf-8',
    timeout: opts.timeout || 30000,
    ...opts
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    exitCode: result.status
  };
}

// Run a fastboot command
function fastboot(fbPath, args, opts = {}) {
  const result = spawnSync(fbPath, args, {
    encoding: 'utf-8',
    timeout: opts.timeout || 30000,
    ...opts
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim()
  };
}

// Get connected device info
function getDeviceInfo(adbPath) {
  const devices = adb(adbPath, ['devices', '-l']);
  if (!devices.ok) return null;

  // Parse the device list — skip header line
  const lines = devices.stdout.split('\n').filter(l => l.includes('device') && !l.startsWith('List'));
  if (lines.length === 0) return null;

  // Get properties
  const model = adb(adbPath, ['shell', 'getprop', 'ro.product.model']).stdout;
  const codename = adb(adbPath, ['shell', 'getprop', 'ro.product.device']).stdout;
  const manufacturer = adb(adbPath, ['shell', 'getprop', 'ro.product.manufacturer']).stdout;
  const androidVersion = adb(adbPath, ['shell', 'getprop', 'ro.build.version.release']).stdout;
  const sdkVersion = adb(adbPath, ['shell', 'getprop', 'ro.build.version.sdk']).stdout;
  const arch = adb(adbPath, ['shell', 'getprop', 'ro.product.cpu.abi']).stdout;
  const kernelVersion = adb(adbPath, ['shell', 'uname', '-r']).stdout;
  const buildNumber = adb(adbPath, ['shell', 'getprop', 'ro.build.display.id']).stdout;

  // Check root
  const suCheck = adb(adbPath, ['shell', 'su', '-c', 'id'], { timeout: 10000 });
  const isRooted = suCheck.ok && suCheck.stdout.includes('uid=0');

  return {
    model,
    codename: codename.toLowerCase(),
    manufacturer: manufacturer.toLowerCase(),
    androidVersion,
    sdkVersion: parseInt(sdkVersion, 10),
    arch,
    kernelVersion,
    buildNumber,
    isRooted,
    hasMultipleDevices: lines.length > 1
  };
}

// Push a file to the phone
function pushFile(adbPath, localPath, remotePath) {
  return adb(adbPath, ['push', localPath, remotePath]);
}

// Install an APK
function installApk(adbPath, apkPath) {
  return adb(adbPath, ['install', '-r', apkPath], { timeout: 120000 });
}

// Run a shell command as root
function rootShell(adbPath, command) {
  return adb(adbPath, ['shell', 'su', '-c', command], { timeout: 60000 });
}

// Reboot to bootloader
function rebootBootloader(adbPath) {
  return adb(adbPath, ['reboot', 'bootloader']);
}

// Reboot normally
function reboot(adbPath) {
  return adb(adbPath, ['reboot']);
}

module.exports = {
  findAdb,
  findFastboot,
  adb,
  fastboot,
  getDeviceInfo,
  pushFile,
  installApk,
  rootShell,
  rebootBootloader,
  reboot
};
