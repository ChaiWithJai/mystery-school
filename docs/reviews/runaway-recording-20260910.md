# Supplied Runaway recording

Jai supplied the MP3. No synthesized substitute is used for soundtrack playback.

- Local copy: `public/audio/local/runaway.mp3`, excluded from git and deployment builds.
- SHA-256: `b123d548cb352f61ed8923bd61646df0b08b4534591a7392ad0e4294a00e06cc`, identical to the supplied file.
- Browser-decoded duration: 547.745669 seconds.
- Actual browser playback reached `opening-ended`, paused at exactly 7 seconds.
- Selected Keep playing, then followed the saved piano take through the tour into boxing.
- On `?path=movement&actor=agent_review`, the same connected audio element was playing at 15.328897 seconds, volume 0.25, with Keep playing checked.
- Activity was agent QA, not human learner feedback. Playback state verifies delivery and continuity, not a listening-quality judgment.
- 296 JavaScript tests and syntax checks pass. Deployment build succeeds and omits the supplied recording.

The 60-second presenter cut uses the same recording controller at the parent page, not independent audio players in each scene. Browsers may require an explicit Play opening or Start gesture.
