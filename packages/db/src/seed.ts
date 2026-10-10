import {
  BRAND,
  clinicDemoLeads,
  clinicDemoStaff,
  clinicPack,
  consentPlainText,
  sha256Hex,
  type IndustryPack,
} from '@healwyn/core';

/** SQL literal helpers. Seed values come from our own typed config, not user input. */
const lit = (value: string | null): string => (value === null ? 'null' : `'${value.replaceAll("'", "''")}'`);
const textArray = (values: readonly string[]): string => `array[${values.map(lit).join(', ')}]::text[]`;
const jsonb = (value: unknown): string => `${lit(JSON.stringify(value))}::jsonb`;
/** A timestamp `days` (plus `hours`) in the past. */
const ago = (days: number, hours = 0): string => `now() - interval '${days} days ${hours} hours'`;

function staffEmail(fullName: string): string {
  const local = fullName
    .replace(/^Dr\.\s*/, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '.')
    .replace(/^\.|\.$/g, '');
  return `${local}@${BRAND.slug}.example`;
}

/**
 * Builds an idempotent seed script for the clinic demo: specialties and staff
 * are upserted, demo leads (is_demo = true) are replaced. Real leads are never touched.
 */
export async function buildSeedSql(pack: IndustryPack = clinicPack): Promise<string> {
  const statements: string[] = [];

  pack.offerings.forEach((offering, index) => {
    statements.push(
      `insert into public.specialties (slug, industry, name, summary, sort_order)
values (${lit(offering.slug)}, ${lit(pack.id)}, ${lit(offering.name)}, ${lit(offering.summary)}, ${index})
on conflict (slug) do update set name = excluded.name, summary = excluded.summary, sort_order = excluded.sort_order, active = true;`,
    );
  });

  for (const member of clinicDemoStaff) {
    statements.push(
      `insert into public.staff (id, industry, full_name, title, level, specialties, languages, locations, email, capacity, is_demo)
values (${lit(member.id)}, ${lit(pack.id)}, ${lit(member.fullName)}, ${lit(member.title)}, ${lit(member.level)}, ${textArray(
        member.specialties,
      )}, ${textArray(member.languages)}, ${textArray(member.locations)}, ${lit(staffEmail(member.fullName))}, ${member.capacity}, true)
on conflict (id) do update set full_name = excluded.full_name, title = excluded.title, level = excluded.level,
  specialties = excluded.specialties, languages = excluded.languages, locations = excluded.locations,
  email = excluded.email, capacity = excluded.capacity, active = true, is_demo = true;`,
    );
  }

  // Replace demo leads. Their consent records and events go with them (cascade).
  statements.push(`delete from public.leads where is_demo and industry = ${lit(pack.id)};`);

  const consentHashes = new Map<string, string>();
  for (const def of pack.intake.consents) consentHashes.set(def.id, await sha256Hex(consentPlainText(def)));

  for (const lead of clinicDemoLeads) {
    const { [pack.intake.messageQuestionId]: _message, ...answers } = lead.answers;
    const offering = answers[pack.intake.offeringQuestionId];
    const specialty = offering && pack.offerings.some((o) => o.slug === offering) ? offering : null;
    // Today's leads arrived a couple of hours ago so their events sort sensibly.
    const created = ago(lead.createdDaysAgo, lead.createdDaysAgo === 0 ? 2 : 0);

    statements.push(
      `insert into public.leads (id, industry, lead_type, source, stage, urgency, full_name, phone, email, message, answers,
  preferred_language, specialty_slug, assigned_staff_id, is_demo, created_at, updated_at)
values (${lit(lead.id)}, ${lit(pack.id)}, 'individual', 'seed', ${lit(lead.stage)}, ${lit(lead.urgency)}, ${lit(
        lead.fullName,
      )}, ${lit(lead.phone)}, ${lit(lead.email)}, ${lit(lead.message)}, ${jsonb(answers)},
  ${lit(lead.preferredLanguage)}, ${lit(specialty)}, ${lit(lead.assignedStaffId)}, true, ${created}, ${created});`,
    );

    for (const def of pack.intake.consents) {
      const granted = def.id === 'assistant_call' ? lead.assistantCallConsent : true;
      statements.push(
        `insert into public.consent_records (lead_id, purpose, granted, text_version, text_hash, source, recorded_at)
values (${lit(lead.id)}, ${lit(def.id)}, ${granted}, ${lit(def.version)}, ${lit(consentHashes.get(def.id) ?? null)}, 'seed', ${created});`,
      );
    }

    const events: { type: string; actor: string; payload: unknown; offsetHours: number }[] = [
      {
        type: 'lead.created',
        actor: 'lead',
        payload: { source: 'web_form', lead_type: 'individual', stage: 'new' },
        offsetHours: 0,
      },
      {
        type: 'consent.recorded',
        actor: 'lead',
        payload: { purposes: { contact: true, assistant_call: lead.assistantCallConsent } },
        offsetHours: 0,
      },
    ];
    if (lead.assignedStaffId) {
      events.push({
        type: 'lead.assigned',
        actor: 'system',
        payload: { staff_id: lead.assignedStaffId },
        offsetHours: 1,
      });
    }
    let previous = pack.initialStageId;
    lead.stageHistory.forEach((stage, index) => {
      events.push({
        type: 'stage.changed',
        actor: 'staff',
        payload: { from: previous, to: stage },
        offsetHours: 2 + index * 20,
      });
      previous = stage;
    });

    for (const event of events) {
      statements.push(
        `insert into public.lead_events (lead_id, type, actor_type, payload, created_at)
values (${lit(lead.id)}, ${lit(event.type)}, ${lit(event.actor)}, ${jsonb(event.payload)}, ${created} + interval '${event.offsetHours} hours');`,
      );
    }
  }

  return statements.join('\n');
}
