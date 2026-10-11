import { toFormPack, type FormPack, type IndustryPack } from '@healwyn/core';

/** What the assistant widget (a client component) needs from the pack. Serializable. */
export interface AssistantView {
  form: FormPack;
  /** The widget's opening sentence. */
  intro: string;
  emergencyNotice: string;
}

export function assistantView(pack: IndustryPack): AssistantView {
  return {
    form: toFormPack(pack),
    intro: `${pack.brand.shortName}’s AI assistant ${pack.site.assistantIntro}`,
    emergencyNotice: pack.brand.emergencyNotice,
  };
}
