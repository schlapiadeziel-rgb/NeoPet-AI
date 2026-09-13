# Testing

Run `npm test` and syntax-check every JavaScript entry point. A release additionally requires OpenAI-envelope tests, companion-memory tests, runtime path/limit/shell-isolation tests, packaged Windows startup, local runtime status checks, real microphone and speech checks, Android `assembleDebug`, and mobile overflow checks.

Mobile automation behavior tests execute the production routing, plan sanitizer and task lifecycle functions in an isolated browser bridge. They cover named-App search routing, disabled plugins, whole-plan rejection, task revalidation before dispatch, short-task completion accounting, cancellation, retry accounting and recovery from an interrupted native service. Android builds must still be installed on a physical device to validate OEM-specific AccessibilityService behavior; an accepted dispatch is never treated as a completed task without a native terminal status.

Network-dependent downloads are installation checks, not unit tests.
