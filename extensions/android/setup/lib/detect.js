const fs = require('fs');
const path = require('path');

const PROFILES_PATH = path.join(__dirname, '..', '..', 'profiles', 'devices.json');

function loadProfiles() {
  return JSON.parse(fs.readFileSync(PROFILES_PATH, 'utf-8'));
}

// Match a detected device to a profile by codename
function matchProfile(deviceInfo) {
  const db = loadProfiles();

  // Try exact codename match
  const match = db.devices.find(d => d.codename === deviceInfo.codename);
  if (match) return { profile: match, isGeneric: false };

  // Try manufacturer + model heuristic
  const mfgMatch = db.devices.find(d =>
    d.manufacturer === deviceInfo.manufacturer &&
    deviceInfo.model.toLowerCase().includes(d.name.toLowerCase().split(' ').pop())
  );
  if (mfgMatch) return { profile: mfgMatch, isGeneric: false };

  // Fall back to generic
  return { profile: db.generic, isGeneric: true };
}

// Determine the correct VolksPC kernel package based on Android version
function resolveVolkspcKernel(deviceInfo) {
  const ver = parseInt(deviceInfo.androidVersion, 10);
  if (ver >= 16) return 'Android16-6.12';
  if (ver >= 15) return 'Android15-6.6';
  if (ver >= 14) return 'Android14-6.1';
  if (ver >= 13) return 'Android13-5.15';
  if (ver >= 12) return 'Android12-5.10';
  return null; // Too old
}

// Get compatibility info
function getCompatibility() {
  return loadProfiles().compatibility;
}

module.exports = { loadProfiles, matchProfile, resolveVolkspcKernel, getCompatibility };
