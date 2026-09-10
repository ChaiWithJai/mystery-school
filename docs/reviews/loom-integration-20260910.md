# Loom implementation checkpoint

Jai's feedback is recorded in `docs/loom-direction-20260910.md`. All three
pathways remain required. This checkpoint is progress, not final acceptance.

## Implemented

- M4 PR12 merged at aa466f1: camera/local-video boxing mirror, four reviewed
  curriculum demonstrations, and separate real-world reflection.
- Piano uses falling cues aligned to actual key rectangles. Hear uses the
  instrument's AudioContext clock; practice uses local input timing. The only
  scored exercise is the source-backed two-strike opening. No full-song or
  mastery claim. Old detached note visualization is hidden.
- Classics opens a walkable Three.js forest with changeable shelter geometry,
  source access, and learner-authored intent/story. Reading and reflection are
  retained, not replaced. Scene context is optional rather than a text wall.

## Verified

- Neo loaded the merged mirror on 5188 without automatically starting a camera.
- An old boxing artifact/proposal reopened with its frozen sources. The affected
  simulation was revealed. An overlap initially blocked consent; positioning
  the affected game separately fixed it. Consent was checked, then selecting a
  different lesson cleared it and disabled Ask. No request was sent.
- Neo rendered the piano roll over E6 and started its count-in. Module tests
  cover timing calculations, lane mapping, and the audio-clock lifecycle.
  Audible quality and human reaction latency are not established.
- Neo rendered the 3D world, opened the writer, entered explicitly agent-QA
  text, saved, and reopened exact intent/story values. Artifact:
  b839cd41-dfae-4360-bb54-bf45f3b99cfd. Trace:
  tr-0c34c4e5c716873b0579faa7e7b513ac. This reused a draft with unlinked historical
  activity; its telemetry correctly says incomplete. No complete-trajectory
  claim. The worker separately observed camera movement from z=9 to about 5.99.
- Independent reviewers found and checked fixes for mirror capture provenance,
  media time/seek segments, bounded frame failures, stale worker errors, source
  consent, frozen story writing, and reversed choice IDs. Both scene renderers
  now activate the displayed ID rather than assuming array order.
- 211 JavaScript tests and 29 backend tests pass. No inference calls in this
  checkpoint. Physical camera accuracy, curriculum progression, final visual
  quality, full Runaway teaching, and learner outcomes remain open.

## Remaining work

Test the real camera with informed participation; verify tracking cadence and
failure recovery. Connect bounded coaching to the mirror without treating
simulation proposals as camera coaching. Review the new scene/roll with Jai and
M4. Test model Apply/walk/write/Undo end to end, including fresh complete traces.
Do not equate a rendered 3D environment with the requested final visual quality.
