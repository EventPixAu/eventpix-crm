# Roadmap

## Current request
- [x] Prevent the general photographer assignment from repeating under the editing date; signed-in Roundtable BNE verified Nigel appears once on the shoot date and only Nat on 29 October; five tests passed, build OK.
- [x] Show the saved Delivery date on the event Overview beneath Delivery - Photographer; signed-in Roundtable PER verified Wednesday 28 October 2026, build OK.
- [x] Show the post-event work date immediately on the Offsite Staff tab, before a role is selected; signed-in preview verified default and calendar selection.
- [x] Allow post-event team assignments on a selected work date, defaulting to the Delivery deadline, with conflicts checked on that date; verified Monday 2 November default, date selection and saved assignment in the signed-in UI; temporary test records removed; four tests passed.
- [x] Show either the post-event work date picker or the session selector in the assignment dialog, never both: Offsite and post-event roles use the work date, Onsite uses the session; verified on the Melbourne Cup event in the signed-in preview.
- [x] Replace minute-by-minute SMS checks with hourly checks (24/day); Trevor accepts up to one hour delay, and the reminder window is widened to prevent missed sends.
- [x] Connect shared ClickSend account and activate crew SMS reminders 24 hours before setup and at finish; credentials verified, 12 tests passed, cancelled events excluded, no live test text sent.
- [x] Crew SMS review screen at /admin/crew-sms: reminders on/off toggle (admin-updateable settings) and sent-text log with status filter and message detail.
- [x] Editable SMS message templates: setup/delivery wording stored in crew_sms_settings, edited on the Crew SMS page with merge fields; unresolved placeholders skip sending; edge function redeployed to read templates.
- [x] Manual follow-up SMS: admin-only "Send follow-up" on the Crew SMS page texts confirmed onsite crew with the delivery/MASV wording; one-hour resend guard per recipient prevents duplicate paid texts; 23 tests passed, function deployed.
- [x] Remove the duplicate "Files via MASV ASAP" upcoming-events card from the Crew SMS page — the follow-up list already shows which events are MASV ASAP; page verified in preview with four cards and no overflow.
- [x] Fix the event Delete button; removed the accidental BNE Dinner entry through the signed-in UI and verified it returned to Events.
- [x] Exclude cancelled events from Day Load, escalation banners and readiness warnings before conflict calculations; test passed and signed-in Day Load verified for 21 October with AIEF careers day absent.
- [ ] Make "Client contact" and "Event Manager" appear in the lead contacts role dropdown on the live site (code done and verified in preview; live bundle still ships the old four options — needs publish).

- [x] Restrict client portals to personally linked events and proposals, support multiple managers on one event, update portal explanations; verified Rowena's three linked events in her signed-in portal and passed four SQL access tests.
- [x] Put Budget (ex GST) and its amount on one line throughout electronic agreement views and PDFs; visually verified CEW in both formats, checked 13 template previews, and passed six existing tests.
- [x] Review all client agreement templates and normalize legacy paragraph/table Event details headers in electronic previews and PDFs, without changing signed wording; checked 13 available template previews, fixed stray stylesheet text and preview merge fields, verified the signed CEW electronic view and all four PDF pages, and passed six existing tests. Series and photographer agreements retain their distinct metadata.
- [x] Remove the standalone agreement date and put Event details labels and values on the same line in electronic agreements and PDFs, preserving signing dates and stored wording; visually verified both formats and passed six existing tests.
- [x] Correct the agreement headings: retain “The Client” and remove “Client Contact” in electronic versions and PDFs; verified electronic preview and downloaded PDF, with six existing tests passing.
- [x] Apply the shared agreement format to all future client agreements and tidy electronic previews, client signing pages, creation previews and series agreements without changing stored signed wording; verified the signed-in electronic preview, visually checked all four PDF pages and passed six PDF tests.
- [x] Move the agreement date into Event details and remove the “The Client” heading from the PDF, retaining the client name and stored signed wording; downloaded and visually verified the first page, with six existing PDF tests passing.
- [x] Add the authorised EventPix signature alongside the client with the client's signing date; fixed image loading during local export and visually verified both signatures on the final PDF page; six tests passed.
- [x] Include recorded signatories in agreement PDF downloads and email attachments; verified signer name, email, Sydney signing date/time and signature image in the signed agreement download; five tests passed.
- [x] Improve agreement PDF spacing and page breaks; verified the signed-in Associations Forum Awards download and visually checked all four pages without changing signed wording.
- [x] Separate onsite/offsite assignment selections and lookup lists; classify Staff roles offsite; verified both lists in the signed-in preview and passed role tests.
- [x] Include onsite contact confirmation and special instructions in the shared delivery-options email and client response.
- [x] Show the response in Sales and Events and preserve it on conversion; client submission verified with intercepted responses, without sending live emails or changing client data.

## Completed this update
- [x] Show availability counts beside each default series team assignment, based on confirmed replies.
- [x] Add an option to send one team invitation covering all dates in the series; verified without sending live email.

## Done
- [x] Make the delivery-options email identical from Sales and Events, including the document and event-linked client response.
- [x] Reuse an existing contact without requiring it to be linked again.
- [x] Add a Declined list page showing declined team members with event, date and reason (route `/declined`, Operations nav "Declined").
- [x] Record decline reason + declined_at when crew declines (Job Sheets dialog and public "Not available" page).
- [x] Remove the assignment counts ("N confirmed / N pending") from the second row of the Events list — pills on the first row remain.
- [x] Remove agreement status badges from event assignment cards; make the Confirmed pill green.
- [x] Recommend Crew: remove the "how many" count field (always recommend everyone) and make the results list scrollable.
- [x] Recommend Crew: include every active Team member, filter by their Team role, and only show already-assigned people when their role matches the search.
- [x] Fix budget follow-up email: include event name and date, provide the correct budget link, and prevent unfilled placeholders from being sent.
- [x] Add "On Hold - Date TBA" as a lead status and make it available wherever lead statuses are selected.
- [x] Clear lead dates, times, and proposed sessions when status changes to On Hold - Date TBA; clear the already-held lead's old dates.

- [x] Add budget-to-event client delivery-options email with the supplied document.
- [x] Provide an easy client delivery-choice response and show the confirmed choice on the event.
- [x] Verify email preparation and client response without sending live test emails.
- [x] Add Location to equipment kits (saved-location dropdown, mirrors equipment items); completed and verified in the preceding update.
