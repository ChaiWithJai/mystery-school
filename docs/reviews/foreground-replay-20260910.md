# Foreground replay

Three captured agent-QA proposals now replay in their foreground instruments.
This is an inspection aid, not acceptance of the school experience.

## Evidence

- Piano: job cd267992-426c-4c01-8787-ecd7e2f2cbe7. Neo applied 60 BPM,
  played E6, stopped capture, and undid to 80 BPM. Page events recorded
  apply, note-on/off, comparison, and undo.
- Boxing: job e11b1851-fa65-4773-87fb-a714e290b07e. Neo applied cue 1.5,
  gap 18; started an exchange; recorded jab/attempt completion; undid to 1.15/14.
- Ideas: job cd93f642-389d-4e72-aeb7-2f5c1c2a1403. Neo applied the captured
  scene, selected both shelter choices and neither, and undid. Shared-state
  readback changed true/false. The same preview/apply/share flow ran on a plain
  Python static server on 5204, without the backend. Resource readback contained
  only local assets and the fixture; no API or external requests.
- Independent code review found missing captured story excerpts and destructive
  cached-page cleanup. Both fixed and re-reviewed. Cached Back behavior has not
  been independently browser-tested.
- 178 JavaScript tests pass, including frozen-context validation for all three
  new fixtures. Syntax checks pass. No new inference was performed.

## Limits

Browser work is agent QA, not participant feedback. Audio quality, physical
training, learning efficacy, and full curriculum progression remain unproven.
Replay events are page-local, not new MLflow traces. Original trace IDs remain
in each fixture. Costs are unknown, not zero. External references open only
when requested. The Loom feedback below supersedes these widgets as the target
experience; replay work must not be substituted for that delivery.
