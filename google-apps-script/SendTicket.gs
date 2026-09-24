const SECRET = 'tropic-boost-ticket';

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    var data = JSON.parse(raw);

    if (data.secret !== SECRET) {
      return json_({ ok: false, error: 'Unauthorized' });
    }
    if (!data.to || !data.pdfBase64 || !data.filename) {
      return json_({ ok: false, error: 'Missing fields' });
    }

    var pdf = Utilities.newBlob(
      Utilities.base64Decode(data.pdfBase64),
      'application/pdf',
      data.filename
    );

    GmailApp.sendEmail(
      data.to,
      data.subject || 'Tropic Boost · Ticket',
      data.body || '',
      {
        name: 'Tropic Boost',
        replyTo: 'info.tropicboost@gmail.com',
        attachments: [pdf]
      }
    );

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'tropic-boost-ticket' });
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Pulsa Run una vez sobre esta función para autorizar Gmail. */
function authorizeOnce() {
  GmailApp.getAliases();
  Logger.log('Autorizado OK');
}
