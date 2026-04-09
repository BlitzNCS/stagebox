#!/usr/bin/env node

// CueBoxx Setup Assistant — Android Extension
// Zero dependencies. Runs on Windows, macOS, and Linux.
// Guides you through setting up CueTools on a rooted Android phone.

const os = require('os');
const prompts = require('./lib/prompts');
const { findAdb, findFastboot, getDeviceInfo } = require('./lib/adb');
const { matchProfile, getCompatibility } = require('./lib/detect');
const rootGuide = require('./lib/root-guide');
const volkspcSetup = require('./lib/volkspc-setup');
const deploy = require('./lib/deploy');
const verify = require('./lib/verify');

async function main() {
  console.log();
  prompts.header('CueBoxx Setup — Android Phone');
  console.log();
  console.log('  This tool sets up CueTools on a rooted Android phone.');
  console.log('  It works alongside the core CueBoxx system (Raspberry Pi)');
  console.log('  as an alternative/additional hardware platform.\n');
  console.log('  You will need:');
  console.log('    - A USB cable connecting your phone to this computer');
  console.log('    - ADB installed (Android Debug Bridge)');
  console.log('    - About 30 minutes\n');

  if (os.platform() === 'win32') {
    console.log('  Windows users: if you see garbled text, run in');
    console.log('  Windows Terminal or PowerShell (not old cmd.exe)\n');
  }

  await prompts.pause();

  // ─── Prerequisites ───────────────────────────────────────────
  prompts.subheader('Checking prerequisites');

  const adbPath = findAdb();
  if (!adbPath) {
    prompts.fail('ADB not found!');
    console.log('\n  Install Android Platform Tools:\n');
    if (os.platform() === 'win32') {
      console.log('  Windows: https://developer.android.com/tools/releases/platform-tools');
      console.log('           Download, extract, add to PATH\n');
    } else if (os.platform() === 'darwin') {
      console.log('  macOS:   brew install android-platform-tools');
      console.log('     or:   https://developer.android.com/tools/releases/platform-tools\n');
    } else {
      console.log('  Linux:   sudo apt install android-tools-adb');
      console.log('     or:   https://developer.android.com/tools/releases/platform-tools\n');
    }
    prompts.info('After installing, re-run this setup.');
    prompts.close();
    process.exit(1);
  }
  prompts.ok(`ADB found: ${adbPath}`);

  const fbPath = findFastboot();
  if (fbPath) {
    prompts.ok(`fastboot found: ${fbPath}`);
  } else {
    prompts.warn('fastboot not found (needed only for rooting — can skip if already rooted)');
  }

  // ─── Device Detection ────────────────────────────────────────
  prompts.subheader('Detecting phone');
  prompts.info('Make sure your phone is connected via USB with USB Debugging enabled.');
  console.log();

  let deviceInfo = getDeviceInfo(adbPath);
  if (!deviceInfo) {
    prompts.fail('No phone detected via ADB.');
    console.log('\n  Troubleshooting:');
    console.log('  1. Connect the phone with a USB cable');
    console.log('  2. Enable USB Debugging:');
    console.log('     Settings > Developer Options > USB Debugging');
    console.log('  3. Accept the "Allow USB debugging" prompt on the phone');
    console.log('  4. If the screen is broken, use scrcpy to mirror it:');
    console.log('     https://github.com/Genymobile/scrcpy\n');

    await prompts.pause('Press Enter to retry...');
    deviceInfo = getDeviceInfo(adbPath);
    if (!deviceInfo) {
      prompts.fail('Still no phone detected. Fix the connection and re-run setup.');
      prompts.close();
      process.exit(1);
    }
  }

  if (deviceInfo.hasMultipleDevices) {
    prompts.warn('Multiple devices connected — using the first one.');
    prompts.info('For best results, connect only the target phone.');
  }

  prompts.ok(`Phone: ${deviceInfo.model} (${deviceInfo.codename})`);
  prompts.ok(`Android: ${deviceInfo.androidVersion} (SDK ${deviceInfo.sdkVersion})`);
  prompts.ok(`Architecture: ${deviceInfo.arch}`);
  prompts.ok(`Kernel: ${deviceInfo.kernelVersion}`);
  prompts.ok(`Root: ${deviceInfo.isRooted ? 'Yes' : 'No'}`);

  // Check architecture
  if (!deviceInfo.arch.includes('arm64') && !deviceInfo.arch.includes('aarch64')) {
    prompts.fail('This phone is not ARM64 — VolksPC requires a 64-bit ARM device.');
    prompts.close();
    process.exit(1);
  }

  // Check Android version
  const androidVer = parseInt(deviceInfo.androidVersion, 10);
  if (androidVer < 12) {
    prompts.fail(`Android ${deviceInfo.androidVersion} is too old. Android 12+ required.`);
    prompts.close();
    process.exit(1);
  }

  // Match to device profile
  const { profile, isGeneric } = matchProfile(deviceInfo);
  console.log();
  if (isGeneric) {
    prompts.warn(`${deviceInfo.model} is not in our device database.`);
    prompts.info('Using generic profile — some steps may need manual adjustment.');
    if (profile.notes) profile.notes.forEach(n => prompts.info(`  ${n}`));
  } else {
    prompts.ok(`Device profile loaded: ${profile.name}`);
    if (profile.hdmiOutput) {
      prompts.ok(`HDMI output: supported (${profile.hdmiMethod})`);
    } else {
      prompts.info('HDMI output: not supported — CuePlayer will need a separate display');
    }
    if (profile.notes.length > 0) {
      profile.notes.forEach(n => prompts.info(`Note: ${n}`));
    }
  }

  // Compatibility warnings
  const compat = getCompatibility();
  if (compat.avoid[deviceInfo.manufacturer]) {
    console.log();
    prompts.warningBox([
      `${deviceInfo.manufacturer.toUpperCase()} DEVICE WARNING`,
      '',
      ...compat.avoid[deviceInfo.manufacturer].match(/.{1,55}/g)
    ]);
    const proceed = await prompts.confirm('Continue anyway?');
    if (!proceed) {
      prompts.close();
      process.exit(0);
    }
  }

  // ─── Choose what to do ───────────────────────────────────────
  console.log();
  const action = await prompts.menu('What would you like to do?', [
    'Full setup (root + VolksPC + CueTools) — start from scratch',
    'Deploy CueTools only — phone is already rooted with VolksPC',
    'Update CueTools — push latest code to phone',
    'Verify installation — check everything is working'
  ]);

  let ok = true;

  if (action === 0) {
    // Full setup
    ok = await rootGuide.run(adbPath, deviceInfo, profile);
    if (ok) {
      // Re-detect after rooting (phone may have rebooted)
      prompts.info('Re-detecting phone after rooting...');
      await prompts.pause('Make sure the phone is connected and unlocked...');
      deviceInfo = getDeviceInfo(adbPath) || deviceInfo;
    }
    if (ok) ok = await volkspcSetup.run(adbPath, deviceInfo, profile);
    if (ok) ok = await deploy.run(adbPath, deviceInfo, profile);
    if (ok) ok = await verify.run(adbPath, deviceInfo, profile);
  } else if (action === 1) {
    // VolksPC + deploy
    ok = await volkspcSetup.run(adbPath, deviceInfo, profile);
    if (ok) ok = await deploy.run(adbPath, deviceInfo, profile);
    if (ok) ok = await verify.run(adbPath, deviceInfo, profile);
  } else if (action === 2) {
    // Deploy only
    ok = await deploy.run(adbPath, deviceInfo, profile);
    if (ok) ok = await verify.run(adbPath, deviceInfo, profile);
  } else {
    // Verify only
    ok = await verify.run(adbPath, deviceInfo, profile);
  }

  prompts.close();
  process.exit(ok ? 0 : 1);
}

main().catch(err => {
  console.error('\nSetup failed with an unexpected error:');
  console.error(err.message);
  prompts.close();
  process.exit(1);
});
