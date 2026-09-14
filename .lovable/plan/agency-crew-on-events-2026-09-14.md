# Agency Crew on Events

Add external crew supplied by an agency to individual events, without creating Team accounts or treating them as internal assignments.

## 1. Agency crew records

Create a dedicated `event_agency_crew` record linked to an event, with:
- Name, role, agency, phone, optional email, optional notes
- Optional session/time-block link for multi-session events
- Created/updated timestamps and creator

Access will follow event operations rules: Admin and Operations can manage records, while other signed-in roles may view them only when they can already access that event. The client receives only the display-safe contact fields through the existing portal responses.

## 2. Event details

On the event **Assignments** tab:
- Add an **Agency Crew** area alongside assigned internal Team members
- Provide an **Add agency crew** form with name, role, agency and phone, plus optional email, notes and session
- Allow Admin and Operations to edit or remove an agency crew member
- Keep agency crew separate from internal assignment workflows, notifications, pay calculations, compliance checks and Team accounts

On the event **Overview**:
- Include agency crew in the **Assigned Team** summary with a clear agency label and phone/email contact details
- Keep internal Team counts and agency crew visually distinguishable

## 3. Client visibility

Include agency crew in both client experiences:
- The signed-in Client Portal event cards
- The event’s public client detail link under **Your Team**

Show name, role, agency, phone and optional email. Do not expose internal notes.

## 4. Verification

- Confirm agency crew can be added without an email address
- Confirm editing and removal work
- Confirm the event Overview and Assignments views display the record correctly
- Confirm both client views show the agency crew and its phone number
- Confirm existing internal Team assignments continue to work unchanged

## Technical details

- Use a separate table rather than nullable internal assignment identities, preventing agency crew from entering account-based workflows or security checks.
- Add authenticated grants, service access for the client portal function, row-level access policies and an update timestamp trigger.
- Update the public client portal function and the signed-in `get_client_portal_data` response to append agency crew to the client-visible team list.
- Deploy and test the updated client portal function after the schema and interface changes.
