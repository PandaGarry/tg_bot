---
name: TDL Replit runtime
description: Replit-specific runtime and proxy constraints for this monorepo.
---

The TDL launch script, workflow wait port, and Replit external proxy must stay on the same local port. In this workspace, that working port is 3000.

**Why:** A healthy server on a different local port can still produce 502 responses through the user-facing Preview when the proxy binding is not recreated at the same time.

**How to apply:** Change the port only together with the `.replit` mapping and workflow registration, then verify both localhost and the external Preview route.