const fs = require('fs');
const path = require('path');
const prompts = require('./prompts');
const { adb, rootShell } = require('./adb');
const { render } = require('./templates');

const CUETOOLS_DIR = path.join(__dirname, '..', '..', '..', '..', 'cuetools');
const REMOTE_BASE = '/data/local/tmp/mxwin/home/desktop/cuetools';

async function run(adbPath, deviceInfo, profile) {
  prompts.header('Phase 3: Deploy CueTools');

  // Generate device-specific scripts from templates
  prompts.subheader('Generating scripts for your device');

  const templateVars = {
    DEVICE_NAME: profile.name || deviceInfo.model,
    DEVICE_CODENAME: profile.codename || deviceInfo.codename,
    ADB_PORT: '5555',
    CUETOOLS_DIR: REMOTE_BASE,
    CUETOOLS_LOG: '/home/desktop/cuetools.log',
    HDMI_ENABLED: profile.hdmiOutput ? 'true' : 'false',
    VOLKSPC_PKG: 'org.volkspc.installer',
    VOLKSPC_ACTIVITY: 'org.volkspc.installer/.MainActivity',
    CUEPLAYER_URL: 'http://localhost:3030/stage'
  };

  const bootScript = render('cueboxx-boot.sh', templateVars);
  const hdmiScript = render('hdmi-watcher.sh', templateVars);
  const rcChroot = render('rc.chroot', templateVars);

  prompts.ok(`Scripts generated for ${templateVars.DEVICE_NAME}`);

  // Deploy CueTools application files
  prompts.subheader('Deploying CueTools');

  // Create directory structure on phone
  prompts.info('Creating directories...');
  rootShell(adbPath, `mkdir -p ${REMOTE_BASE}/lib ${REMOTE_BASE}/ui ${REMOTE_BASE}/config ${REMOTE_BASE}/videos`);

  // Push core files
  const filesToPush = [
    { local: 'cuetools.js', remote: `${REMOTE_BASE}/cuetools.js` },
    { local: 'package.json', remote: `${REMOTE_BASE}/package.json` }
  ];

  // Push lib files
  const libDir = path.join(CUETOOLS_DIR, 'lib');
  if (fs.existsSync(libDir)) {
    for (const f of fs.readdirSync(libDir).filter(f => f.endsWith('.js'))) {
      filesToPush.push({ local: `lib/${f}`, remote: `${REMOTE_BASE}/lib/${f}` });
    }
  }

  // Push UI files
  const uiDir = path.join(CUETOOLS_DIR, 'ui');
  if (fs.existsSync(uiDir)) {
    for (const f of fs.readdirSync(uiDir).filter(f => f.endsWith('.html'))) {
      filesToPush.push({ local: `ui/${f}`, remote: `${REMOTE_BASE}/ui/${f}` });
    }
  }

  // Push config if no existing config
  const configCheck = rootShell(adbPath, `test -f ${REMOTE_BASE}/config/cues.json && echo exists`);
  if (!configCheck.stdout.includes('exists')) {
    filesToPush.push({ local: 'config/cues.json', remote: `${REMOTE_BASE}/config/cues.json` });
  } else {
    prompts.info('Existing cue config found — keeping it');
  }

  let pushed = 0;
  for (const file of filesToPush) {
    const localPath = path.join(CUETOOLS_DIR, file.local);
    if (!fs.existsSync(localPath)) {
      prompts.warn(`File not found: ${file.local}`);
      continue;
    }

    // Push to staging area first, then copy with root
    const staging = `/sdcard/Download/_cuetools_${path.basename(file.local)}`;
    const pushResult = adb(adbPath, ['push', localPath, staging]);
    if (pushResult.ok) {
      rootShell(adbPath, `cp "${staging}" "${file.remote}"`);
      rootShell(adbPath, `rm "${staging}"`);
      pushed++;
    }
  }
  prompts.ok(`${pushed} files deployed to phone`);

  // Install npm dependencies inside chroot
  prompts.info('Installing Node.js dependencies inside VolksPC...');
  const npmResult = rootShell(adbPath,
    `chroot /data/local/tmp/mxwin /bin/bash -c "cd /home/desktop/cuetools && npm install --production"`,
  );
  if (npmResult.ok) {
    prompts.ok('npm dependencies installed');
  } else {
    prompts.warn('npm install may not have completed — check manually inside VolksPC');
  }

  // Deploy boot scripts
  prompts.subheader('Deploying boot scripts');

  // Write generated scripts to temp files, push to phone
  const tmpDir = require('os').tmpdir();

  const scripts = [
    { content: bootScript, staging: '/sdcard/Download/_cueboxx-boot.sh', dest: '/data/adb/service.d/cueboxx-boot.sh', perms: '755' },
    { content: hdmiScript, staging: '/sdcard/Download/_hdmi-watcher.sh', dest: '/data/local/tmp/hdmi-watcher.sh', perms: '755' },
    { content: rcChroot, staging: '/sdcard/Download/_rc.chroot', dest: '/data/local/tmp/mxwin/etc/rc.chroot', perms: '755' }
  ];

  for (const script of scripts) {
    const tmpFile = path.join(tmpDir, path.basename(script.dest));
    fs.writeFileSync(tmpFile, script.content, { mode: 0o755 });

    const pushResult = adb(adbPath, ['push', tmpFile, script.staging]);
    if (pushResult.ok) {
      rootShell(adbPath, `cp "${script.staging}" "${script.dest}" && chmod ${script.perms} "${script.dest}"`);
      rootShell(adbPath, `rm "${script.staging}"`);
      prompts.ok(`Deployed: ${path.basename(script.dest)}`);
    } else {
      prompts.fail(`Failed to push: ${path.basename(script.dest)}`);
    }

    // Clean up temp file
    try { fs.unlinkSync(tmpFile); } catch {}
  }

  // Set ownership
  rootShell(adbPath, `chown -R 1000:1000 ${REMOTE_BASE}`);

  prompts.ok('CueTools deployment complete');
  return true;
}

module.exports = { run };
