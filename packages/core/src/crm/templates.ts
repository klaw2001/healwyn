import { BRAND } from '../brand';
import type { MessageTemplate } from './types';

export interface TemplateVariables {
  fullName: string;
  specialty?: string | null;
  reference: string;
  unsubscribeUrl: string;
}

export interface RenderedMessage {
  subject: string | null;
  text: string;
}

function firstName(fullName: string): string {
  return fullName.replace(/^(Dr\.?|Mr\.?|Mrs\.?|Ms\.?)\s+/i, '').split(/\s+/)[0] ?? fullName;
}

function fill(text: string, vars: TemplateVariables): string {
  return text
    .replaceAll('{firstName}', firstName(vars.fullName))
    .replaceAll('{brand}', BRAND.name)
    .replaceAll('{specialty}', vars.specialty ?? 'the right specialist')
    .replaceAll('{reference}', vars.reference)
    .replaceAll('{contactEmail}', BRAND.contactEmail);
}

/**
 * Renders a template. Emails always end with a working unsubscribe link and
 * the demo notice; SMS and WhatsApp end with an opt-out line.
 */
export function renderTemplate(template: MessageTemplate, vars: TemplateVariables): RenderedMessage {
  const body = fill(template.body, vars);
  if (template.channel === 'email') {
    return {
      subject: template.subject ? fill(template.subject, vars) : `${BRAND.name}: an update`,
      text: [
        body,
        '',
        '--',
        `${BRAND.name} (${BRAND.demoNotice.toLowerCase()})`,
        `Unsubscribe from these emails: ${vars.unsubscribeUrl}`,
      ].join('\n'),
    };
  }
  return { subject: null, text: `${body}\nReply STOP to opt out.` };
}

/** Tokens a template may use. Unknown tokens are a configuration bug. */
export const TEMPLATE_TOKENS = ['{firstName}', '{brand}', '{specialty}', '{reference}', '{contactEmail}'] as const;

export function unknownTokens(template: MessageTemplate): string[] {
  const used = `${template.subject ?? ''} ${template.body}`.match(/\{[a-zA-Z]+\}/g) ?? [];
  return used.filter((token) => !(TEMPLATE_TOKENS as readonly string[]).includes(token));
}
