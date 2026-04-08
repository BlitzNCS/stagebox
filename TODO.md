# STAGEBOX TODO

## High Priority — Before first gig

- [ ] **Update server.js QLC+ integration to use WebSocket** (currently uses HTTP which doesn't exist — must connect to `ws://localhost:9999/qlcplusWS` and send `QLC+API|setFunctionStatus|ID|1`)
- [ ] Test real MIDI from XR18 → USB MIDI → phone (confirmed working with test interface, need full chain test)
- [ ] Confirm MIDI channel 15 program changes arrive correctly from Stage Traxx 4
- [ ] Push latest server.js (channel 15 + boards) to phone
- [ ] Program QLC+ fixtures on Windows/Mac (add actual lights with correct DMX addresses)
- [ ] Create QLC+ scenes, chasers, and shows for each song
- [ ] Save workspace as `.qxw`, push to phone, update rc.chroot to load it
- [ ] Get QLC+ function IDs from web API test page
- [ ] Map each StageCue cue to a QLC+ function ID via config page
- [ ] Create/source video content for each song
- [ ] Push all videos to phone
- [ ] Set up MIDI tracks in Stage Traxx 4 (PC on channel 15 for each song)
- [ ] Full end-to-end test: Stage Traxx → XR18 MIDI out → USB MIDI → phone → lights + video
- [ ] Set DHCP reservation on stage router

## Medium Priority

- [ ] Test with actual projector / LED wall (not just home TV)
- [ ] Test hot-plug HDMI mid-show (unplug/replug recovery)
- [ ] Test MIDI interface disconnect/reconnect
- [ ] Test multiple boards — switch bands from iPad mid-gig
- [ ] Video performance testing with large files
- [ ] Video codec recommendations (H.264 MP4 recommended)
- [ ] Back up phone setup (Magisk module export or nandroid)

## Low Priority — Nice to have

- [ ] Productify StageCue for Raspberry Pi (separate project)
- [ ] Config page: add QLC+ function picker (query getFunctionsList, show dropdown)
- [ ] Config page: video upload via browser (currently ADB push only)
- [ ] StageCue: audio passthrough for videos with sound
- [ ] StageCue: image/text cue support
- [ ] StageCue: crossfade duration config per cue
- [ ] Stagebox dashboard (system health monitoring page)
- [ ] nginx reverse proxy
- [ ] dnsmasq for .stagebox DNS
- [ ] Deploy script (single command pushes all files to phone)
- [ ] Phone screen off without killing HDMI

## Known Issues

- Display ID increments each HDMI plug (watcher handles dynamically)
- VolksPC desktop sometimes shows black (doesn't affect headless services)
- Chrome fullscreen tap coordinates may vary on different display sizes
- Screen-off (keyevent 26) kills both phone and HDMI — removed from boot script
- QLC+ has no ALSA sequencer for direct MIDI — StageCue bridges via WebSocket
- VolksPC evaluation: keyboard dies after 10 mins (irrelevant for gig use)
