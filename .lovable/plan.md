# Add “Not required” to crew logistics

## Changes
- Add “Not required” as a distinct saved choice for both Meal provided and Parking provided.
- Keep the existing “Not set”, “Yes”, and “No” states unchanged.
- Show “Not required” consistently when reopening an event and anywhere shared logistics appear to clients.

## Technical details
- Store the new state separately so it is not confused with an unanswered field.
- Extend the client-facing event data and displays to recognise the new state.
- Verify both selectors save and reload correctly.
