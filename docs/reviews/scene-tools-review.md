# Requested tools sheet — Loom correction

Addresses Jai’s actual 0:43–1:09 review in Loom `0ffe594257cc427491dead332198ccb0`: the cramped star menu and tiny, poorly spaced supporting controls.

Load `public/scene-tools.css` after existing scene CSS. This file preserves the existing native details toggle, action handlers, notebook/character disclosures and contextual panels. Opening the tools presents a deliberate spacious sheet with three primary action tiles, secondary practice choices, and readable disclosures. Closing it returns to the unobstructed scene. This does not implement focus trapping or change dialog semantics; it remains a native details disclosure. The muted scene background is visual separation, not a claim that keyboard input is suspended.

Actual Chromium browser checks against isolated server5214, baselineab1692f, with the exact stylesheet injected: 1080×592,1440×900,390×844. Screenshots are in `scene-tools/`. All three primary buttons use14px text and heights58px,74px,and53.59px respectively. Sheet remains within viewport at each size. No page exceptions. Keyboard Enter on the focused summary closes the sheet. No model invocation or learner outcomes.

The native details body uses `::details-content` for grid layout, verified in the current Chromium preview. Older browser layout is not verified. This is a supporting-tool correction, not completion of the separate Guitar Hero piano or immersive story-world request.
