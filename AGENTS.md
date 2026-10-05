Email send handlers must reject unresolved `{{...}}` placeholders before delivery, because multiple compose screens and scheduled sends share the same sender.
The lead On Hold - Date TBA transition clears dates and lead-only sessions in database triggers, because status can be changed from several screens.
Lead-status display ordering is centralized in the shared lead-status hook, so detail and edit menus agree without changing stored statuses.
Client delivery preferences use a dedicated expiring event token and separate preference table; explicit client confirmation must not silently alter operational delivery settings.
Delivery-options emails use the existing Gmail review dialog with a mandatory asset-backed attachment; conversion opens a review window and never sends automatically.