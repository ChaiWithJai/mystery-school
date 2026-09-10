# Verify the school

Install dependencies using the [README](../README.md#run-locally), then run its syntax, JavaScript, and Python checks. Passing these checks establishes implementation behavior within their coverage, not instructional efficacy.

## Check clean startup

From a clean checkout with dependencies installed, run the isolated HTTP check on a free port.

```sh
.venv/bin/python scripts/check-clean-setup.py --port 5196 --require-clean
```

The script creates temporary data, disables model discovery, checks served tracked assets and empty API collections, and stops its own server. It refuses an occupied port. Without `--require-clean`, it reports worktree differences. See [reproduction details](reproducible-delivery.md) for historical environments and limitations.

## Check the experience

Follow the [presenter cue sheet](demo-cue-sheet.md) on the actual device. Verify piano input and audible output, camera permission and framing, retained observations, return navigation, and recovery from an unavailable model. Capture the exact revision and distinguish real camera input from a source-video or synthetic fixture.

The [demo journey verifier](reviews/demo-journey-verifier.md) documents browser automation prerequisites. Legacy walkthrough scripts can depend on private local records; they are not fresh-clone tests.

## Check inference and teaching claims

For live readiness, make an actual configured Bonsai request and an actual Astra artifact request, inspect their traces, and verify feedback appears for the correct attempt. Test loss of companion connectivity while interaction continues. Record latency on the actual machine.

A fixture can verify routing and validation. It cannot establish live model access, accurate physical measurement, or learning. Teacher-led evaluation needs predictions, explanations, and transfer evidence, as described in the [instructional brief](teacher-sandbox.md).
