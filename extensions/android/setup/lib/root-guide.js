const prompts = require('./prompts');
const { adb, fastboot, findFastboot, rebootBootloader, getDeviceInfo } = require('./adb');

async function run(adbPath, deviceInfo, profile) {
  prompts.header('Phase 1: Root Your Phone');

  if (deviceInfo.isRooted) {
    prompts.ok('Phone is already rooted!');
    return true;
  }

  prompts.info(`Device: ${profile.name} (${profile.codename || deviceInfo.codename})`);
  prompts.info(`Boot partition: ${profile.bootPartition}`);
  prompts.info(`Root difficulty: ${profile.rootDifficulty}`);
  console.log();

  if (profile.rootDifficulty === 'varies' || profile.manufacturer === 'unknown') {
    prompts.warn('This device is not in our database.');
    prompts.info('You will need to root it manually. Search XDA Developers for:');
    prompts.info(`  "${deviceInfo.model} Magisk root guide"`);
    prompts.info('Once rooted, re-run this setup.');
    await prompts.pause();
    return false;
  }

  // Manufacturer-specific warnings
  if (profile.oemUnlock === 'mi-unlock') {
    prompts.warningBox([
      'XIAOMI UNLOCK NOTICE',
      '',
      'Xiaomi requires you to apply for bootloader unlock',
      'permission via their Mi Unlock Tool. There is a',
      'mandatory waiting period of 7-30 days.',
      '',
      'Visit: https://en.miui.com/unlock/download_en.html',
      '',
      'Come back and re-run this setup after unlocking.'
    ]);
    const ready = await prompts.confirm('Has your bootloader already been unlocked?');
    if (!ready) {
      prompts.info('Run this setup again after completing the Xiaomi unlock process.');
      return false;
    }
  }

  const choice = await prompts.menu('How would you like to proceed?', [
    'Guided rooting (step by step, recommended)',
    'Skip — I will root the phone myself and re-run setup',
    'My phone is already rooted (re-check)'
  ]);

  if (choice === 1) {
    prompts.info('Root your phone, then re-run this setup.');
    prompts.info('Recommended guide: https://topjohnwu.github.io/Magisk/install.html');
    return false;
  }

  if (choice === 2) {
    const recheck = getDeviceInfo(adbPath);
    if (recheck && recheck.isRooted) {
      prompts.ok('Root confirmed!');
      return true;
    }
    prompts.fail('Root not detected. Make sure Magisk is installed and granted superuser.');
    return false;
  }

  // Guided rooting
  return await guidedRoot(adbPath, deviceInfo, profile);
}

async function guidedRoot(adbPath, deviceInfo, profile) {
  const bootPart = profile.bootPartition === 'auto-detect'
    ? (deviceInfo.sdkVersion >= 33 ? 'init_boot' : 'boot')
    : profile.bootPartition;

  // Step 1: Developer Options
  prompts.step(1, 'Enable Developer Options');
  console.log('    On your phone:');
  console.log('    Settings > About Phone > tap "Build Number" 7 times');
  console.log();
  console.log('    Then enable:');
  console.log('    Settings > System > Developer Options:');
  console.log('      - USB Debugging: ON');
  console.log('      - OEM Unlocking: ON');
  if (deviceInfo.sdkVersion >= 34) {
    console.log('      - Enable Desktop Experience Features: ON (for HDMI)');
  }
  await prompts.pause();

  // Step 2: Unlock bootloader
  prompts.step(2, 'Unlock Bootloader');
  prompts.warningBox([
    'WARNING: UNLOCKING THE BOOTLOADER ERASES ALL DATA!',
    'Back up anything important before continuing.',
    'This is fully reversible later if needed.'
  ]);

  const proceed = await prompts.confirm('Ready to unlock the bootloader?');
  if (!proceed) return false;

  prompts.info('Rebooting to bootloader...');
  rebootBootloader(adbPath);
  console.log();
  prompts.info('Waiting for bootloader mode...');
  prompts.info('(If the phone has a broken screen, watch for the fastboot screen)');
  await prompts.pause('Press Enter when the phone shows the bootloader screen...');

  const fbPath = findFastboot();
  if (!fbPath) {
    prompts.fail('fastboot not found! Install Android Platform Tools.');
    prompts.info('Download: https://developer.android.com/tools/releases/platform-tools');
    return false;
  }

  prompts.info('Unlocking bootloader...');
  const unlock = fastboot(fbPath, ['flashing', 'unlock']);
  console.log();
  prompts.info('Use the VOLUME keys on your phone to select "Unlock"');
  prompts.info('Then press the POWER button to confirm.');
  await prompts.pause('Press Enter after the phone reboots...');

  prompts.info('After the phone reboots and you complete minimal setup:');
  prompts.info('  1. Re-enable USB Debugging in Developer Options');
  prompts.info('  2. Reconnect the USB cable');
  await prompts.pause('Press Enter when ready...');

  // Step 3: Get boot image
  prompts.step(3, `Get ${bootPart}.img`);

  if (profile.factoryImageBase) {
    console.log(`    Download the factory image for your build number.`);
    console.log(`    Your build: ${deviceInfo.buildNumber}`);
    console.log(`    URL: ${profile.factoryImageBase}#${profile.codename || ''}`);
    console.log();
    console.log(`    Extract the ZIP, then extract image-*.zip inside it.`);
    console.log(`    You need the file: ${bootPart}.img`);
  } else {
    console.log(`    Your device doesn't have downloadable factory images.`);
    console.log(`    You'll need to extract ${bootPart}.img from an OTA update.`);
    console.log(`    Search: "${profile.name} extract ${bootPart}.img payload dumper"`);
  }

  console.log();
  const imgPath = await prompts.ask(`Path to ${bootPart}.img on this computer`);
  if (!imgPath || !require('fs').existsSync(imgPath)) {
    prompts.fail(`File not found: ${imgPath}`);
    return false;
  }

  // Step 4: Magisk patch
  prompts.step(4, 'Patch with Magisk');
  prompts.info('Installing Magisk on your phone...');

  const magiskApk = await prompts.ask('Path to Magisk APK (or press Enter to skip if already installed)');
  if (magiskApk && require('fs').existsSync(magiskApk)) {
    const install = adb(adbPath, ['install', '-r', magiskApk], { timeout: 120000 });
    if (install.ok) {
      prompts.ok('Magisk APK installed');
    } else {
      prompts.warn('APK install failed — install it manually on the phone');
    }
  }

  prompts.info(`Pushing ${bootPart}.img to phone...`);
  const push = adb(adbPath, ['push', imgPath, '/sdcard/Download/']);
  if (!push.ok) {
    prompts.fail('Failed to push file to phone');
    return false;
  }
  prompts.ok('File pushed to /sdcard/Download/');

  console.log();
  console.log('    On your phone:');
  console.log('    1. Open the Magisk app');
  console.log('    2. Tap "Install" next to Magisk');
  console.log('    3. Choose "Select and Patch a File"');
  console.log(`    4. Navigate to Downloads > select ${bootPart}.img`);
  console.log('    5. Wait for patching to complete');
  await prompts.pause('Press Enter when Magisk says "All done!"...');

  // Step 5: Flash patched image
  prompts.step(5, 'Flash patched boot image');
  prompts.info('Pulling the patched image from phone...');

  // Find the patched file
  const ls = adb(adbPath, ['shell', 'ls', '/sdcard/Download/magisk_patched*.img']);
  if (!ls.ok || !ls.stdout) {
    prompts.fail('Could not find patched image in /sdcard/Download/');
    prompts.info('Look for a file named magisk_patched-XXXXX.img and flash it manually.');
    return false;
  }
  const patchedRemote = ls.stdout.split('\n').pop().trim();
  const patchedLocal = require('path').join(require('os').tmpdir(), 'magisk_patched.img');

  const pull = adb(adbPath, ['pull', patchedRemote, patchedLocal]);
  if (!pull.ok) {
    prompts.fail('Failed to pull patched image');
    return false;
  }
  prompts.ok('Patched image downloaded');

  prompts.info('Rebooting to bootloader...');
  rebootBootloader(adbPath);
  await prompts.pause('Press Enter when in bootloader mode...');

  prompts.info(`Flashing ${bootPart}...`);
  const flash = fastboot(fbPath, ['flash', bootPart, patchedLocal], { timeout: 120000 });
  if (!flash.ok) {
    prompts.fail(`Flash failed: ${flash.stderr}`);
    return false;
  }
  prompts.ok('Boot image flashed!');

  prompts.info('Rebooting...');
  fastboot(fbPath, ['reboot']);
  console.log();
  prompts.info('Wait for the phone to boot completely (can take a few minutes).');
  prompts.info('Then re-enable USB Debugging if prompted.');
  await prompts.pause('Press Enter when the phone is fully booted...');

  // Verify root
  const recheck = getDeviceInfo(adbPath);
  if (recheck && recheck.isRooted) {
    prompts.ok('Root verified! Magisk is working.');
    return true;
  }

  prompts.warn('Root not detected yet. Open Magisk app on the phone and check.');
  prompts.info('It may ask to complete setup and reboot once more.');
  await prompts.pause('Press Enter after completing Magisk setup...');

  const finalCheck = getDeviceInfo(adbPath);
  return finalCheck && finalCheck.isRooted;
}

module.exports = { run };
