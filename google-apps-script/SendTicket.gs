/**
 * Google Apps Script — envío automático del ticket PDF desde Gmail.
 *
 * 1. Entra en https://script.google.com con info.tropicboost@gmail.com
 * 2. Nuevo proyecto → pega TODO este archivo
 * 3. Implementar → Nueva implementación → Tipo: Aplicación web
 *    - Ejecutar como: Yo
 *    - Quién tiene acceso: Cualquiera
 * 4. Copia la URL de la app web
 * 5. En GitHub Secrets / .env local:
 *    VITE_GMAIL_SCRIPT_URL=https://script.google.com/macros/s/XXXX/exec
 *    VITE_GMAIL_SCRIPT_SECRET=tropic-boost-ticket   (mismo valor que SECRET abajo)
 * 6. Redeploy
 */

const SECRET = 'tropic-boost-ticket'; // cámbialo si quieres

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    if (data.secret !== SECRET) {
      return json_({ ok: false, error: 'Unauthorized' });
    }
    if (!data.to || !data.pdfBase64 || !data.filename) {
      return json_({ ok: false, error: 'Missing fields' });
    }

    const pdf = Utilities.newBlob(
      Utilities.base64Decode(data.pdfBase64),
      'application/pdf',
      data.filename,
    );

    GmailApp.sendEmail(data.to, data.subject || 'Tropic Boost · Ticket', data.body || '', {
      name: 'Tropic Boost',
      replyTo: 'info.tropicboost@gmail.com',
      attachments: [pdf],
    });

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, service: 'tropic-boost-ticket' });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
