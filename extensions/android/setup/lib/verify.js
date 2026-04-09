const prompts = require('./prompts');
const { adb, rootShell, getDeviceInfo } = require('./adb');

async function run(adbPath, deviceInfo, profile) {
  prompts.header('Phase 4: Verification');

  let allGood = true;

  // Check root
  const info = getDeviceInfo(adbPath);
  if (info && info.isRooted) {
    prompts.ok('Root access');
  } else {
    prompts.fail('Root access');
    allGood = false;
  }

  // Check VolksPC installed
  const vpc = adb(adbPath, ['shell', 'pm', 'list', 'packages', 'org.volkspc']);
  if (vpc.ok && vpc.stdout.includes('org.volkspc')) {
    prompts.ok('VolksPC installed');
  } else {
    prompts.fail('VolksPC not found');
    allGood = false;
  }

  // Check CueTools files exist
  const ctCheck = rootShell(adbPath,
    'test -f /data/local/tmp/mxwin/home/desktop/cuetools/cuetools.js && echo found'
  );
  if (ctCheck.stdout.includes('found')) {
    prompts.ok('CueTools deployed');
  } else {
    prompts.fail('CueTools files not found on phone');
    allGood = false;
  }

  // Check boot script
  const bootCheck = rootShell(adbPath,
    'test -f /data/adb/service.d/cueboxx-boot.sh && echo found'
  );
  if (bootCheck.stdout.includes('found')) {
    prompts.ok('Boot script installed');
  } else {
    prompts.fail('Boot script not found');
    allGood = false;
  }

  // Check rc.chroot
  const rcCheck = rootShell(adbPath,
    'test -f /data/local/tmp/mxwin/etc/rc.chroot && echo found'
  );
  if (rcCheck.stdout.includes('found')) {
    prompts.ok('rc.chroot configured');
  } else {
    prompts.fail('rc.chroot not found');
    allGood = false;
  }

  // Check HDMI watcher
  if (profile.hdmiOutput) {
    const hdmiCheck = rootShell(adbPath,
      'test -f /data/local/tmp/hdmi-watcher.sh && echo found'
    );
    if (hdmiCheck.stdout.includes('found')) {
      prompts.ok('HDMI watcher installed');
    } else {
      prompts.warn('HDMI watcher not found (needed for video output)');
    }
  } else {
    prompts.info('HDMI watcher skipped (device has no HDMI output)');
  }

  // Check Node.js inside chroot
  const nodeCheck = rootShell(adbPath,
    'chroot /data/local/tmp/mxwin /bin/bash -c "node --version 2>/dev/null"'
  );
  if (nodeCheck.ok && nodeCheck.stdout.startsWith('v')) {
    prompts.ok(`Node.js ${nodeCheck.stdout} inside VolksPC`);
  } else {
    prompts.warn('Node.js not detected inside VolksPC — install it manually');
  }

  // Check QLC+
  const qlcCheck = rootShell(adbPath,
    'chroot /data/local/tmp/mxwin /bin/bash -c "which qlcplus 2>/dev/null"'
  );
  if (qlcCheck.ok && qlcCheck.stdout) {
    prompts.ok('QLC+ installed inside VolksPC');
  } else {
    prompts.warn('QLC+ not detected inside VolksPC — install it for lighting control');
  }

  // Summary
  console.log();
  if (allGood) {
    prompts.header('Setup Complete!');
    console.log('  CueBoxx is ready. On next boot:\n');
    console.log('  1. Phone powers on');
    console.log('  2. Magisk runs the boot script');
    console.log('  3. VolksPC starts > rc.chroot runs');
    console.log('  4. CueTools starts on port 3030');
    console.log('  5. QLC+ starts on port 9999');
    if (profile.hdmiOutput) {
      console.log('  6. HDMI watcher launches CuePlayer on external display');
    }
    console.log(`\n  CueDeck: http://<phone-ip>:3030/deck`);
    console.log(`  CuePlayer: http://<phone-ip>:3030/stage\n`);

    const rebootNow = await prompts.confirm('Reboot the phone now to test?');
    if (rebootNow) {
      const { reboot } = require('./adb');
      reboot(adbPath);
      prompts.info('Rebooting... wait about 60 seconds for services to start.');
    }
  } else {
    prompts.subheader('Some checks failed');
    prompts.info('Fix the issues above and re-run setup, or use deploy-quick.sh for manual deployment.');
  }

  return allGood;
}

module.exports = { run };
