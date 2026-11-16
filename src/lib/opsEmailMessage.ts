export function prepareOpsEmailMessage(
  subject: string,
  bodyHtml: string,
  resolveFields: (text: string) => string,
) {
  const message = { subject: resolveFields(subject), bodyHtml: resolveFields(bodyHtml) };
  if (/\{\{\s*[^{}]+?\s*\}\}/.test(`${message.subject} ${message.bodyHtml}`)) {
    throw new Error('Email contains unfilled fields. Complete them before sending.');
  }
  return message;
}