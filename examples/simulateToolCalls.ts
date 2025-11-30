import { SUPPORTED_LANGUAGES } from '../constants';
import { makeToolResponse, successResponse, errorResponse } from '../utils/toolUtils';

// Simulate incoming tool-call payloads from a model and show how you'd validate and respond.

try {
  // Example: report_language_change
  const languageCall = {
    id: 'call-123',
    name: 'report_language_change',
    args: { language: 'isiZulu' }
  };

function validateLanguageArgs(args: any) {
  const errors: string[] = [];
  if (!args || typeof args !== 'object') {
    errors.push('Missing args');
  }
  const lang = args?.language;
  if (!lang || typeof lang !== 'string') {
    errors.push('Missing language field');
  } else if (!SUPPORTED_LANGUAGES.includes(lang)) {
    errors.push(`Unsupported language: ${lang}`);
  }
  return errors;
}

const languageErrors = validateLanguageArgs(languageCall.args);
if (languageErrors.length === 0) {
  console.log('Valid language, would set detected language and return ok:');
  console.log(successResponse(languageCall.id, languageCall.name, 'ok'));
} else {
  console.log('Invalid language args — respond with errors:');
  console.log(errorResponse(languageCall.id, languageCall.name, languageErrors));
}

// Example: send_email
const emailCall = {
  id: 'call-456',
  name: 'send_email',
  args: { subject: 'Hello', body: '<b>Test</b>', recipient_email: 'bob@example.com' }
};

function validateSendEmailArgs(args: any) {
  const errors: string[] = [];
  if (!args || typeof args !== 'object') errors.push('Missing args');
  if (!args?.subject || typeof args.subject !== 'string') errors.push('Missing subject');
  if (!args?.body || typeof args.body !== 'string') errors.push('Missing body');
  if (args?.recipient_email && typeof args.recipient_email !== 'string') errors.push('recipient_email must be a string');
  return errors;
}

const emailErrors = validateSendEmailArgs(emailCall.args);
if (emailErrors.length === 0) {
  console.log('Email args valid. Would call sendGenericEmail and reply success:');
  console.log(makeToolResponse(emailCall.id, emailCall.name, { result: 'Sent' }));
} else {
  console.log('Email args invalid. Respond with errors:');
  console.log(
    makeToolResponse(emailCall.id, emailCall.name, { result: 'Failed', errors: emailErrors })
  );
}
} catch (error) {
  console.error('Error in simulation:', error);
}
