# Boxing foundations — additional primary-source review

Reviewed 2026-09-10. No product files changed. This extends the seven previously reviewed day-one clips.

## What was actually inspected

Fetched all 20 public pages of the KO Boxing Guides & Tips curriculum, mapped the linked full lessons on pages 4–5, and retrieved English automatic captions for six linked videos. For the actionable recommendations below, additionally retrieved actual short video sections and visually inspected five-second contact sheets. The captions locate spoken instructions; the images support demonstrated movement, not exact gaze tracking or audio fidelity. Full video audio was not independently listened to.

Canonical lesson index: https://boxing.dharmicdata.org/library/guides-and-tips/4
Canonical mental-preparation index: https://boxing.dharmicdata.org/library/guides-and-tips/5
All six retrieved video metadata records name **Andrii Khotin** as uploader. These findings do not justify attribution to Derek James or Terence Crawford.

## Directly supported additions

| Foundation | Reviewed source and original-video time | What the inspected material supports | Minimal optional practice cue |
|---|---|---|---|
| Catch / respond | [Boxing Defense 101](https://www.youtube.com/watch?v=EQu3RPrjs6A&t=1333), **22:13–22:39** | Small forward hand movement receives the incoming punch. The instructor contrasts it with reaching too far away from the guard. Both receiving-hand variants appear in the demonstration. | Receive close to your guard. |
| Parry / respond | [Same lesson](https://www.youtube.com/watch?v=EQu3RPrjs6A&t=1368), **22:48–23:18** | Small downward/sideways hand deflection, followed by a counter while the other hand is displaced. This directly supports a receive/deflect-and-respond sequence. | Deflect a little, then respond. |
| Eyes / head | [Same lesson](https://www.youtube.com/watch?v=EQu3RPrjs6A&t=372), **06:12–06:17**, and **06:40–06:50** | Spoken cue is to continue looking forward while slipping/rotating, rather than down or aside. Frames show the stance/rotation demonstration. It does not establish named A/B positions or a specific gaze fixation point. | Keep looking forward as you move. |
| Coordinated punches | [Boxing Punch Tutorial](https://www.youtube.com/watch?v=dAZnOeMSk6o&t=111), **01:51–02:12** | A teaching progression adds hip and heel rotation to punching; one shoulder moves backward while the other moves forward. Actual clip shows frontal-stance explanation and punches. | Turn with the punch. |
| Counter response, alternate lesson | [Secrets to Landing Clean Counter Punches](https://www.youtube.com/watch?v=25pq4-dvX1w&t=46), **00:46–01:11** | Partner demonstration of parry-and-counter, then step-back response. Supports the relationship of defense and response, not a camera's ability to grade it. | Notice the response after the defense. |

Choose one cue per attempt. The hip/shoulder passage is a source-backed progression, **not proof of Jai's exact intended sequencing**. Do not turn its instructional order into a universal timing rule.

## Calm breath / attention: stronger written anchors

- [Guide page 10](https://boxing.dharmicdata.org/library/guides-and-tips/10): rhythmic breathing and relaxation during shadow boxing.
- [Guide page 12](https://boxing.dharmicdata.org/library/guides-and-tips/12): keeping relaxed and using rhythmic breathing during partner work.
- [Guide page 14](https://boxing.dharmicdata.org/library/guides-and-tips/14): present attention, observing the partner's movement, and leaving an approach with a defensive move.
- [Guide page 17](https://boxing.dharmicdata.org/library/guides-and-tips/17): controlled breathing and defense during bag work.
- The Punch Tutorial captions additionally locate exhalation rather than breath holding at **14:23–14:28**. That particular video section was **caption-reviewed only**, not visually reviewed in this pass. Prefer the written page-10 anchor for an immediately publishable breathing cue.

## Missing / not established

- **A/B slots:** no explicit definition found in the 20 guide pages or the six reviewed automatic-caption files. Preserve this as Jai's unresolved terminology; do not substitute left/right, orthodox/southpaw, slip positions, or stance types by guess.
- **Swords / shields / wheels / helmet:** treat these as Jai's teaching metaphors, separate from canonical source language. Hands-up/forearms/head movement/footwork sources can sit underneath them; these videos do not authenticate the metaphors themselves.
- **Jai's exact hip/shoulder sequence:** general coordination demonstrated; exact intended sequence still unprovided.
- **Technique correctness:** camera display or a recorded attempt cannot establish successful catching, correct gaze, safe sparring, or Crawford-level technique. Keep the output learner observation plus source provenance.

## Local evidence inventory

Directory: `/tmp/boxing-foundations-source/`
- `video-manifest.json`: page-4/page-5 lesson-title → video mapping.
- `page-1.txt` through `page-20.txt`: inspected public page text.
- `EQu3RPrjs6A.en.vtt`, `dAZnOeMSk6o.en.vtt`, `25pq4-dvX1w.en.vtt`: timestamped automatic captions; adjacent `.info.json` files contain title/uploader metadata.
- `defence-catch.mp4`: original **22:10–23:18**; sheet cells at five-second intervals begin at 22:10.
- `defence-gaze.mp4`: original **06:08–06:55**; sheet starts at 06:08.
- `punch-coordination.mp4`: original **01:48–02:18**; sheet starts at 01:48.
- `counter-response.mp4`: original **00:40–01:12**; sheet starts at 00:40.
- Each section has a `-sheet.jpg` contact sheet visually inspected in this review. No full video was published or added to git.

### Review-section SHA256 values

These hashes identify trimmed review copies, not complete original videos. Timestamped links above always use the original video clock.

- `defence-catch.mp4`: `f3701d01954ab0219fbe17465d057ef4555969471c5231d0fc2ac193c74e2941`; original section starts at 1330 seconds.
- `defence-gaze.mp4`: `6092e7981308e408e605d1e276cddc490ee16b82207416366796812cc539b517`; original section starts at 368 seconds.
- `punch-coordination.mp4`: `301540fc8f2a8e5b98a438e34552562fcc2c521b4a57d639f3536c5b40973de8`; original section starts at 108 seconds.
- `counter-response.mp4`: `26717af03deea202401c20d49a64c1cb221f8612ac10846f48fdecb3c37ea161`; original section starts at 40 seconds.
