# Memory: features/event-management/brief-management
Updated: now

The Client Brief panel supports manual template selection and AI-driven generation. AI generation utilizes an Edge Function to compile event metadata (coverage hours, crew, pre-registration link) into a professional summary. The AI prompt is specifically configured to:
- Skip salutations/greetings and jump straight into content
- Only include ONSITE crew (editors, retouchers, post-production roles are filtered out server-side)
- NOT repeat event details (date, time, venue) that are displayed elsewhere in the portal
- Read the Team Brief (internal `brief_content` field) to extract arrival time and setup details — referencing them naturally without copying internal instructions verbatim
- NOT fabricate arrival times if the Team Brief doesn't mention them
- Reference pre-registration links without printing full URLs

Generated briefs can be manually edited before being shared with the client.
