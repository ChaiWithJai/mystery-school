# Day-one boxing: reviewed video evidence

Reviewed the actual four linked MP4s, extracted English captions, inspected contact sheets covering each clip at three-second intervals, and inspected the exact timestamped frames below. Local files are review-only in `/tmp/boxing-source-review`; no full video or caption files are committed. Machine-readable results and SHA256 values are in `boxing-day1-reviewed.json`.

| Video | One cue for the mirror | Exact inspected evidence |
| --- | --- | --- |
| rV3m-gHRCXw | Keep your hands up. | 00:12 burned-in instruction and frontal demonstration with both hands at face. Spoken automatic captions also locate this instruction around 00:11–12. |
| qUzOrInwIJE | Shift your weight from one foot to the other. | 00:01 burned-in instruction and staggered stance demonstration; subsequent frames progress to shoulder/hip rotation and punches. Auto-captions are song fragments, not coaching. |
| YVpudYmtAGw | Start with rolls in one spot. | 00:01 visibly titles the clip a defensive drill and instructs rolls in one spot. Subsequent on-screen stages are forward, backward, uppercuts, pivots/combos. Caption file is music only. |
| nyJ14GOUtAo | Move without crossing your feet. | 00:11 burned-in instruction over moving demonstration. Earlier frames show changing directions, later frames introduce L/Z steps. Auto-captions are music/lyric fragments. |

**Curriculum correction:** the source manifest labels YVpudYmtAGw “FRONTAL STANCE MOVEMENT DRILL.” The actual video is a defensive roll progression. Use an accurate displayed title and retain the original curriculum mapping in provenance. Do not silently teach it as a generic stance lesson.

All four are published by Andrii Khotin. yt-dlp successfully downloaded playable MP4 format18 copies and reports public availability with `playable_in_embed: true`. This verifies media retrieval and embedding eligibility metadata; it does not guarantee YouTube iframe playback under the demo's origin/referrer/browser settings. Use the `/embed/ID` URLs in the JSON with a visible original-source escape. Signed direct stream URLs expire and should not be hardcoded. If a local authorized copy is provisioned separately, the four local MP4s are under 1.4MiB each; don't put full media in git.

These are short first-noticing cues, not a complete boxing curriculum or substitutes for the full demonstration. No stance technique, footwork correctness, force, physical readiness, or Crawford resemblance is inferred from the PR5 upper-body punch detector. In particular, it cannot verify the no-crossing-feet cue: show the learner's whole body and ask them to notice their feet. The curated cue comes from visible source instruction; learner reflection is evidence of what they noticed, not certified technique.
