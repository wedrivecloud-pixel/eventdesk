# Package number inputs — September 7, 2026

## Fix

The general dialog width overrode the package dialog's width, and a fixed
three-column extra-hours grid compressed the hour/minute inputs. The package
dialog now honors its own width. Rate and duration controls wrap based on the
space available, with space reserved for units, digits, and native spinners.

Numeric package fields retain an editable text draft. Deleting zero leaves the
input empty while typing; a completed value is normalized on blur. Focusing a
zero selects it for replacement. Invalid minutes remain visible and do not
silently carry into the hours field.

## Browser verification

Tested against the local development app using a new package named
`Package input QA 2026-09-07`. No production records were edited.

- Create: clear Hourly Rate with Backspace; value remains empty. Type `125.50`
  sequentially and move focus; the decimal amount remains correct.
- Both keyboard Up/Down and mouse spinner clicks change minimum hours from
  `3` to `4` and back (keyboard also checked `4` to `5` and back).
- Enter `60` in minimum minutes: native validity fails, the input stays `60`,
  and hours remain `3`. Correct it to `30` before saving.
- Create/save stores starting rate `$499`, hourly rate `$125.50`, included
  length `4 hr`, minimum `3 hr 30 min`, maximum `8 hr`.
- Edit: clear the existing hourly rate and enter `95.75`, change maximum
  minutes to `45`, save, close, and reopen. All values persist exactly.
- Desktop (1440 × 1000): minimum/maximum inputs are 95–103 px wide; digits,
  spinners, unit labels, and the full increment selection are visible.
- Normal in-app preview (909 × 639): rate controls wrap into two columns.
- Narrow screen (375 × 812): controls stack with hour/minute inputs 190–198 px
  wide. No clipped numeric text. Temporary viewport override was reset.

## Validation

TypeScript passes. Focused lint passes for the numeric input and pricing editor.
The existing package-editor file still reports its pre-existing image and
deprecated React FormEvent lint rules. The production build succeeds with the
existing bundle-size, duplicated manage stylesheet, and route-classification
warnings.
