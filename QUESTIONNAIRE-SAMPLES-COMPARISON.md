# Questionnaire sample library comparison

Reviewed September 6, 2026 using the signed-in Check Cherry browser, without saving changes to that account.

Reference: https://sipovac-photobooth.checkcherry.com/admin/form_templates/new

The reference has a Create From Scratch form and ten sample cards, each with Preview and Add to my account. EventDesk now offers Create from scratch, searchable sample cards, interactive Preview, and Use sample → customize → Save changes. Saved questionnaires also have a Preview questionnaire action. Each copy has fresh field identifiers and correctly remapped conditional references.

| Reference sample | Preview ID | EventDesk coverage |
| --- | --- | --- |
| General Event Planner | 2329 | Guest count, theme, additional information |
| Model Release | 11788 | Editable photo-use scope, agree/disagree, typed name, date |
| Music Planner | 11780 | Preferences, guest requests, explicit lyrics, promised and excluded songs, playlist links |
| Photo Booth Detailed Event Planner | 11789 | Contact details, event purpose, guest count, dress code, design/artwork uploads, event and booth hours, power, Wi-Fi, parking and setup notes |
| Post-Event Client Survey | 11784 | Three required ratings and feedback; after-event default |
| Post-Event Staff Notes | 13011 | Summary, arrival, incidents, equipment, supplies, event energy and improvement notes; four conditional required follow-ups; staff-only and after-event defaults |
| Wedding Planner - Classic | 11781 | Six tabs for preferences, song lists, ceremony, cocktail hour and reception; song/artist and separate time inputs |
| Wedding Planner with Suggestions | 11783 | Detailed wedding planner plus selectable, editable song suggestions |
| Wedding Timeline-Only | 11782 | Eleven wedding timeline time fields |
| Wedding Timeline-Only with Suggestions | 11778 | Ceremony and reception tabs with song suggestions, speakers, times and additional instructions |

Sample questions are written for EventDesk. No Check Cherry customer records, media or account templates were imported. Creating or previewing a sample does not save preview answers. Staff/client permissions and package scope remain editable. Existing template application, synchronization and finalized-questionnaire locks are preserved. Questionnaire editor previews no longer force the owner to answer required sample questions before saving the template.

## Deliberate capability differences

- Model Release collects consent and a typed name. It does not add Check Cherry's drawn e-signature dialog or a signature-provider audit service. The editable permission scope must be customized before sharing.
- Song suggestions are local editable options, and playlist URLs can be recorded. Live streaming-catalog search, playable track previews and Spotify playlist import are not connected.
- Repeated notes and song lists use multiline inputs. Timeline moments use separately editable time fields rather than the reference's Set Time popover.
- Samples remain in the library until the owner chooses and saves a copy; the update does not populate the owner's template list automatically.

## Verification

- `node tests/questionnaires-api.mjs`: all ten templates validate, save and reload; unique copies, remapped conditions, required follow-ups, staff defaults, package scope, booking application, answer persistence, finalize/reopen/sync and authorization checks pass. Includes the questionnaire unit suite.
- `node tests/manage-unit.mjs`: existing pricing, conditional questions and template synchronization checks pass.
- `npx tsc --noEmit`: pass.
- `npm run build`: pass.
- Focused lint passes for the new sample library, catalog, tests and modified question input. Broader legacy manager/editor files retain existing lint findings (unused imports, image rules, status markup, array keys and explicit `any`).
- Browser: all ten cards visible; staff follow-up appears on No; wedding tabs and song selection work; customized sample saves and reopens; create-from-scratch, required question editing and saving with an unanswered live preview work. Test records are local only and removed afterward.
