# Runaway sound repair

The opening E6 now uses a locally bundled Yamaha C5 piano sample instead of
a sustained triangle tone. Alexander Holm's Salamander sample is licensed
under CC BY 3.0. Attribution and upstream notes accompany the file in
`public/audio/piano/`.

The sample is D-sharp 6, played one semitone higher for E6. It is an isolated
instrument note, not the song recording. Other keys use decaying synthesized
partials. Failed or delayed sample decoding uses that explicit fallback.

## Observed

Main BrowserOS QA on port 5188:

- Hear decoded the bundled sample and the guide followed the audio clock.
- The first L press after reload captured E6 on/off and used the sample.
- Event `291b267f-a978-4fa4-84e9-b037684f5970` records `sampled_piano`,
  source MIDI 87 and playback rate 1.0594630943592953.
- Trace: `tr-96154ba4ede6abe070af3adfb787830d`.
- The opening now shows Runaway, the artist, Hear, Play, and the L cue.
  Stop appears during guided playback. Sources and other tools remain optional.

The sample test checks decoded-buffer playback, timing, release, failure
fallback and cleanup. 245 JavaScript tests pass. An earlier in-progress test
failed before the async test fix and was stopped; the final full run passed.

No claim of acoustic similarity to the mastered recording or human learning
is made. Browser events describe scheduled playback, not a microphone recording
of the speaker output. The exercise still covers the published first two
strikes, not the complete Virtual Piano arrangement. The unchanged backend
reports build `6485c6ccd23d33bb`; frontend changes were served live.
