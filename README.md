# Open Jobs scheduler

Runs the permitted-feed refresh and checks the public Open Jobs catalogue once an hour. The website, source code and database remain in their existing private project and repositories.

This repository contains only scheduling and public health-check scripts. It contains no job data, application source, credentials or database exports. The updater authenticates with short-lived GitHub OIDC tokens; the Site accepts only this exact repository ID, owner ID, main branch and workflow. Provider cache intervals, retry backoff, pagination checkpoints and leases are enforced by the Site.

Uses standard GitHub-hosted runners. No paid runner or spending-limit changes are required. An account-level GitHub billing lock may still require the owner to contact GitHub support.
