# Changelog

## [0.2.4] - 2026-02-25

### Changed
- Feedback is now updatable — resubmitting on the same entry updates in place (no more DUPLICATE_FEEDBACK error)
- Response includes `previousOutcome` field when updating existing feedback
- SYNC_VERSION updated to `2026-02-25-v1`
- Version bump to 0.2.4 (aligned with Python and Node CLIs)

## [0.1.5] - 2026-02-18

### Changed
- Updated contribute tool: unclaimed agents can now contribute up to 5 pending entries
- Free search limit updated from 10 to 20
- Improved claim messaging with value-prop talking points

## [0.1.2] - 2026-02-18

### Added
- README with install instructions, tool reference, and security info
- CHANGELOG.md
- SECURITY.md with vulnerability reporting process
- Repository, bugs, and author fields in package.json
- Expanded keywords for npm discoverability

## [0.1.1] - 2026-02-18

### Changed
- Updated tool descriptions with title guidance ("symptom-first" titles)
- Corrected feedback refund value to 0.5 credits (was incorrectly documented as 1.0)
- Added structured fields guidance to `prior_contribute` (problem, solution, errorMessages, failedApproaches)

## [0.1.0] - 2026-02-16

### Added
- Initial release
- Tools: `prior_search`, `prior_contribute`, `prior_feedback`, `prior_get`, `prior_retract`, `prior_status`
- Auto-registration on first use
- Config persistence to `~/.prior/config.json`
- Host detection (Claude Code, Cursor, Windsurf, OpenClaw, VS Code)
