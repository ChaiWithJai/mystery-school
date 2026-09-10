# Continue the school inside the story

The homepage reference is the actual `SchoolWorld` renderer with `loadBlender()` and the existing `public/assets/school.glb`, rendered at 1440×900. The before/after images show `mountStoryWorld` at the same viewport and initial camera position.

- [Homepage renderer](homepage.png)
- [Before](before.png)
- [After](after.png)

The story now loads the **same GLB** beyond the walkable clearing: the central library pavilion, great tree, floating islands and connecting threads remain recognizable. Foreground trees use the homepage's pine/moss palette and mixed canopy silhouettes, with an opening toward those landmarks. Homepage hemisphere light, gold sunlight, teal rim light, ACES tone mapping and exposure carry into the story. No new world asset or engine is introduced.

The GLB is visual scenery outside the navigation boundary, not a new interactive destination. Existing story decisions, camera controls, writer, source and saved-memory links remain the interactive layer. Loading the asset does not create a learner memory or change learner state. If the asset cannot load, the existing playable clearing remains available; the emitted asset event identifies the failure without claiming a loaded scene. Asset resources are disposed, including completion of a load after the view was closed.

Validation: all 238 existing JavaScript tests pass. Isolated real Chromium checks confirmed asset arrival preserves the complete state, an `agent_review` memory keeps its exact observation and artifact link, exact story whitespace survives, W moves the camera, and disposal removes the canvas. The fixture is agent review, not a real learner's evidence. Root integration into the full application remains a separate check.
