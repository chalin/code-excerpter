# Migration Notes

This document tracks the migration of the Dart excerpter tooling to TypeScript.

## Plaster processing

About the original model:

- From plaster.dart, I see that the `plaster` args were setting
  `plasterTemplate`; and that a `null` plaster template meant "use the lang
  template default", while `plaster=""` meant an empty plaster template.
- There was never any capacity for a user to set only, what we've started
  calling, the "plaster string", only the full "plaster template".

If memory serves, in the very first implementation, plaster was "···". That was
it: no template, no lang specific comment, just "···". With experience, I
realized that it was a bad idea to have a bare "···" plaster, because it
rendered the code excerpts invalid from the pov of tooling. So I introduced the
idea of lang specific comments to contain the plaster in.

In a bit more detail:

- There was a plaster, default as "···", configurable
- And the `--yaml` flag, which would cause the plaster to be embedded in a lang
  specific comment, unless overridden
- All plaster argument values affected the plaster _template_
