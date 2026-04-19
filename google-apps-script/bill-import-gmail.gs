const SUPABASE_FUNCTION_URL =
  "https://bktrxpodekaoyckfzqst.supabase.co/functions/v1/process-bill-email";

const BILL_IMPORT_WEBHOOK_SECRET =
  "PASTE_THE_SAME_SECRET_HERE";

const IMPORT_MAILBOX = "PASTE_YOUR_GMAIL_ADDRESS_HERE";
const PROCESSED_LABEL = "subtification-imported";

function processBillImportInbox() {
  const label = getOrCreateLabel_(PROCESSED_LABEL);
  const query = `to:${IMPORT_MAILBOX} -label:${PROCESSED_LABEL} newer_than:30d`;
  const threads = GmailApp.search(query, 0, 20);

  threads.forEach((thread) => {
    thread.getMessages().forEach((message) => {
      if (!isImportMessage_(message)) return;

      const response = UrlFetchApp.fetch(SUPABASE_FUNCTION_URL, {
        method: "post",
        muteHttpExceptions: true,
        contentType: "application/json",
        headers: {
          "x-import-secret": BILL_IMPORT_WEBHOOK_SECRET,
        },
        payload: JSON.stringify({
          messageId: message.getId(),
          from: message.getFrom(),
          to: message.getTo(),
          subject: message.getSubject(),
          text: message.getPlainBody(),
          html: message.getBody(),
          receivedAt: message.getDate().toISOString(),
        }),
      });

      const status = response.getResponseCode();
      if (status < 200 || status >= 300) {
        throw new Error(
          `Supabase import failed: ${status} ${response.getContentText()}`,
        );
      }
    });

    thread.addLabel(label);
  });
}

function createBillImportTrigger() {
  ScriptApp.newTrigger("processBillImportInbox")
    .timeBased()
    .everyMinutes(5)
    .create();
}

function isImportMessage_(message) {
  const to = `${message.getTo()} ${message.getCc()}`.toLowerCase();
  const [name, domain] = IMPORT_MAILBOX.toLowerCase().split("@");
  return to.includes(`${name}+`) && to.includes(`@${domain}`);
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}
