import type { Brand } from '../brand';
import type { MessageTemplate } from './types';

export interface TemplateVariables {
  /** The lead's pack brand. */
  brand: Brand;
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
    .replaceAll('{brand}', vars.brand.name)
    .replaceAll('{specialty}', vars.specialty ?? 'the right specialist')
    .replaceAll('{reference}', vars.reference)
    .replaceAll('{contactEmail}', vars.brand.contactEmail);
}

/**
 * Renders a template. Emails always end with a working unsubscribe link and
 * the demo notice; SMS and WhatsApp end with an opt-out line.
 */
export function renderTemplate(template: MessageTemplate, vars: TemplateVariables): RenderedMessage {
  const body = fill(template.body, vars);
  if (template.channel === 'email') {
    return {
      subject: template.subject ? fill(template.subject, vars) : `${vars.brand.name}: an update`,
      text: [
        body,
        '',
        '--',
        `${vars.brand.name} (${vars.brand.demoNotice.toLowerCase()})`,
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
