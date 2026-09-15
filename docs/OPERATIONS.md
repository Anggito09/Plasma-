# Operating Temancipta

## Start a shift

1. Open Temancipta on the cashier device and sign in with a cashier account.
2. Open `/dapur` on the kitchen device using a kitchen account.
3. Open `/display` on the device connected to the TV using a display account.
4. Click **Aktifkan suara** once on the TV browser. Confirm the activation message is audible; select full-screen mode.
5. Check the connection indicator before accepting orders. A disconnected screen shows a warning instead of claiming it is live.

A Chrome browser on a computer connected by HDMI is a practical TV setup. The TV browser must support speech synthesis for voice calls. Use one speaker-enabled display per audible area; separate enabled displays will each play calls. Test the actual device's Indonesian voice, speaker volume, browser idle behavior, and receipt printer before opening.

## Order flow

1. Select menu items; enter the customer's call name, service type, and optional note.
2. Receive payment externally, then choose the recorded payment method.
3. Save the order. The server allocates the queue number and stores the menu names and prices as a historical snapshot.
4. Print the receipt from the receipt dialog. Select an 80 mm thermal paper profile, disable browser headers/footers, and check margins. Reprint from the active list or history if printing is cancelled or fails; do not recreate the order.
5. Kitchen: **Mulai proses** → **Siap & panggil**. A saved call event reaches the TV on its next refresh.
6. **Panggil ulang** sends another call; **Diambil** removes the order from the active display and retains it in history.
7. Cashier/admin can cancel an active order with a reason. Refunds are processed outside Temancipta.

Calls are sequential, so a busy period can create an audio backlog even though the order is already visible. Calls for collected or cancelled orders are skipped. A newly opened TV starts after the current event cursor; it does not announce historical calls. Use recall for an order that needs another announcement. If audio fails or the page is reloaded, enable sound again and recall affected orders.

## Daily numbering

- Format: A0001, A0002, … A1000, A1001, … A10000. Padding is a minimum width, not a limit.
- The server calculates the business date using the cafe timezone selected during setup: WIB, WITA, or WIT.
- The first successfully saved order on each new date receives A0001. No cron job or destructive reset is required.
- An order's stable identity is its UUID; the display number is unique within its business date.
- Orders still waiting, preparing, or ready from previous dates remain active and show their original date. Receipts and history always retain that date.
- Never change server clocks manually during operation. The timezone is locked after setup to keep transaction dates consistent.

## Access

| Role | Access |
| --- | --- |
| Admin | All workflows, cafe settings, menu, staff accounts, activity log, own password |
| Cashier | Create orders, kitchen actions, cancellation, history, receipts |
| Kitchen | Active orders, start preparation, mark ready, recall, mark collected, receipts |
| Display | Read queue and call events only |

Sessions expire after 12 hours. Sign in at the start of a shift. Disabling a staff account invalidates its active sessions immediately. The administrator can change their password; all their sessions are invalidated. Store the initial administrator password securely. Staff password reset and self-service recovery are not included in this version; an administrator can disable a lost account and create a replacement with a new username.

## Connection and retries

The queue refreshes every 3 seconds; display call events refresh every 5 seconds (hemat kuota request, panggilan tetap berurutan via cursor). Saved data lives in the server database, not browser local storage. New orders cannot be submitted while the board is known to be disconnected.

If a save fails after an uncertain connection result, retry the same unchanged order. Temancipta reuses its request ID, so the server returns the previously saved order instead of allocating another number. Do not change the draft or reload until checking history for the original order. Browser drafts are not durable, and offline order entry is not supported.

GET/POST that hit a 5xx or network drop retry twice automatically (login/setup excluded). If the board shows **Menyambung…**, wait; new orders stay disabled until live.

See `docs/RUNBOOK.md` for demo vs paid-client steps, phishing checks, and restore.
