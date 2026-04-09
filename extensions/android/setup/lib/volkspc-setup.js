const fs = require('fs');
const path = require('path');
const prompts = require('./prompts');
const { adb, rootShell, installApk } = require('./adb');
const { resolveVolkspcKernel } = require('./detect');

async function run(adbPath, deviceInfo, profile) {
  prompts.header('Phase 2: Install VolksPC Linux');

  // Check if VolksPC is already installed
  const checkVpc = adb(adbPath, ['shell', 'pm', 'list', 'packages', 'org.volkspc']);
  const alreadyInstalled = checkVpc.ok && checkVpc.stdout.includes('org.volkspc');

  if (alreadyInstalled) {
    prompts.ok('VolksPC is already installed');
    const reinstall = await prompts.confirm('Reinstall/update VolksPC?');
    if (!reinstall) return true;
  }

  const kernel = resolveVolkspcKernel(deviceInfo);
  if (!kernel) {
    prompts.fail(`Android ${deviceInfo.androidVersion} is too old for VolksPC.`);
    prompts.info('Android 12 or newer is required.');
    return false;
  }

  prompts.info(`Android version: ${deviceInfo.androidVersion}`);
  prompts.info(`Required VolksPC kernel package: ${kernel}`);
  console.log();

  // Guide user through downloads
  prompts.subheader('Download VolksPC Files');
  console.log('  You need two files from volkspc.org:\n');
  console.log('  1. Linux root image:');
  console.log('     https://www.volkspc.org/installation/');
  console.log('     Download: volkspcimgarm64.zip\n');
  console.log('  2. GKI Kernel APKs:');
  console.log('     https://www.volkspc.org/');
  console.log(`     Download the ${kernel} package`);
  console.log('     (contains InstallerXXX.apk and Desktop.apk)\n');

  // Get file paths from user
  const imgZip = await prompts.ask('Path to volkspcimgarm64.zip');
  if (!imgZip || !fs.existsSync(imgZip)) {
    prompts.fail(`File not found: ${imgZip}`);
    return false;
  }

  const apkDir = await prompts.ask('Path to folder containing the VolksPC APKs');
  if (!apkDir || !fs.existsSync(apkDir)) {
    prompts.fail(`Directory not found: ${apkDir}`);
    return false;
  }

  // Find APKs
  const apkFiles = fs.readdirSync(apkDir).filter(f => f.endsWith('.apk'));
  const installerApk = apkFiles.find(f => /installer/i.test(f));
  const desktopApk = apkFiles.find(f => /desktop/i.test(f));

  if (!installerApk) {
    prompts.fail('Could not find InstallerXXX.apk in the directory');
    prompts.info(`Files found: ${apkFiles.join(', ') || 'none'}`);
    return false;
  }
  if (!desktopApk) {
    prompts.fail('Could not find Desktop.apk in the directory');
    return false;
  }

  // Push and install
  prompts.subheader('Installing VolksPC');

  prompts.info('Pushing Linux image to phone (this may take a few minutes)...');
  const pushImg = adb(adbPath, ['push', imgZip, '/sdcard/Download/'], { timeout: 600000 });
  if (!pushImg.ok) {
    prompts.fail('Failed to push volkspcimgarm64.zip');
    return false;
  }
  prompts.ok('Linux image pushed');

  prompts.info('Installing VolksPC Installer APK...');
  const instResult = installApk(adbPath, path.join(apkDir, installerApk));
  if (instResult.ok) {
    prompts.ok('Installer APK installed');
  } else {
    prompts.warn(`Installer APK failed: ${instResult.stderr}`);
    prompts.info('Try installing it manually on the phone.');
  }

  prompts.info('Installing VolksPC Desktop APK...');
  const deskResult = installApk(adbPath, path.join(apkDir, desktopApk));
  if (deskResult.ok) {
    prompts.ok('Desktop APK installed');
  } else {
    prompts.warn(`Desktop APK failed: ${deskResult.stderr}`);
  }

  // Run the installer
  prompts.subheader('Run the VolksPC Installer');
  console.log('  On your phone (or via scrcpy):\n');
  console.log('  1. Open the "VolksPC Installer" app');
  console.log('  2. It should find volkspcimgarm64.zip automatically');
  console.log('  3. Follow the prompts');
  console.log('  4. Allocate at least 8GB for the root partition');
  console.log('  5. Wait for installation (~5 minutes)\n');
  console.log('  After install, open the "VolksPC Desktop" app once');
  console.log('  to verify it boots into the Linux desktop.\n');
  await prompts.pause('Press Enter when VolksPC is installed and working...');

  // Install dependencies inside the chroot
  prompts.subheader('Installing CueTools Dependencies');
  prompts.info('Installing Node.js, QLC+, and ALSA tools inside VolksPC...');

  const installCmd = [
    'apt-get update',
    'apt-get install -y nodejs npm qlcplus alsa-utils'
  ].join(' && ');

  // Try running inside the chroot
  const installResult = rootShell(adbPath,
    `chroot /data/local/tmp/mxwin /bin/bash -c "${installCmd}"`
  );

  if (installResult.ok) {
    prompts.ok('Dependencies installed inside VolksPC');
  } else {
    prompts.warn('Automatic dependency install did not complete.');
    console.log('  You may need to install manually inside VolksPC:\n');
    console.log('  Open a terminal in the VolksPC desktop and run:');
    console.log('    sudo apt update && sudo apt install -y nodejs npm qlcplus alsa-utils\n');
    await prompts.pause();
  }

  prompts.ok('VolksPC setup complete');
  return true;
}

module.exports = { run };
