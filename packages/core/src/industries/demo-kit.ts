import type { UrgencyLevel } from '../crm/types';
import { STAFF_ROLES, type StaffRole } from '../permissions';

/**
 * Shared building blocks for every pack's synthetic demo data: the types the
 * seed reads, deterministic ids, a seeded PRNG and fictional names. Ids carry
 * the pack's number (clinic 0, real estate 1, wealth 2, interiors 3), so packs
 * never collide. Nothing here is real.
 */

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  bn: 'Bengali',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  mr: 'Marathi',
  pa: 'Punjabi',
  ta: 'Tamil',
  ur: 'Urdu',
};

export interface DemoStaffMember {
  readonly id: string;
  readonly fullName: string;
  readonly title: string;
  readonly level: string;
  /** Permission role in the CRM. */
  readonly role: StaffRole;
  readonly specialties: readonly string[];
  readonly languages: readonly string[];
  readonly locations: readonly string[];
  readonly capacity: number;
  /** Listed on the public team page (doctors, advisors, designers). */
  readonly listed: boolean;
  /** Backs the CRM's "Sign in as" demo button for this role (one per role). */
  readonly demoLogin?: boolean;
  readonly bio?: string;
}

export interface DemoNote {
  templateId: string;
  /** Minutes after the lead was created. */
  afterMinutes: number;
  authorStaffId: string;
}

export interface DemoTask {
  title: string;
  /** Relative to now: negative means overdue. */
  dueInMinutes: number;
  completed: boolean;
  assigneeStaffId: string;
}

export interface DemoLead {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  preferredLanguage: string;
  stage: string;
  urgency: UrgencyLevel;
  answers: Readonly<Record<string, string>>;
  message: string | null;
  assistantCallConsent: boolean;
  assignedStaffId: string | null;
  /** Stages after "new", oldest first. */
  stageHistory: readonly string[];
  createdMinutesAgo: number;
  /** Minutes after creation of the first staff action, or null when nobody has responded yet. */
  firstResponseAfterMinutes: number | null;
  notes: readonly DemoNote[];
  tasks: readonly DemoTask[];
  optedOut: boolean;
  /** Minutes after creation when the lead replied, or null. */
  repliedAfterMinutes: number | null;
}

/** mulberry32: a tiny, deterministic PRNG. */
export function prng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!,
    chance: (p: number) => next() < p,
  };
}

export type Rng = ReturnType<typeof prng>;

export const DEMO_FIRST_NAMES = [
  'Aarav',
  'Aditi',
  'Akash',
  'Ananya',
  'Arjun',
  'Bhavna',
  'Chetan',
  'Deepika',
  'Divya',
  'Farah',
  'Gaurav',
  'Harini',
  'Ishaan',
  'Jaya',
  'Karan',
  'Kavya',
  'Lakshmi',
  'Manish',
  'Meera',
  'Nikhil',
  'Nisha',
  'Omkar',
  'Pallavi',
  'Pranav',
  'Priya',
  'Rahul',
  'Riya',
  'Rohan',
  'Sahil',
  'Sana',
  'Shreya',
  'Siddharth',
  'Sneha',
  'Tanvi',
  'Tarun',
  'Uma',
  'Varun',
  'Vidya',
  'Yash',
  'Zoya',
];
export const DEMO_LAST_NAMES = [
  'Agarwal',
  'Banerjee',
  'Chopra',
  'D’Souza',
  'Fernandes',
  'Ghosh',
  'Gupta',
  'Hegde',
  'Iyer',
  'Jain',
  'Kapoor',
  'Khan',
  'Kulkarni',
  'Malhotra',
  'Mehta',
  'Nair',
  'Pandey',
  'Patel',
  'Pillai',
  'Rao',
  'Reddy',
  'Saxena',
  'Sharma',
  'Shetty',
  'Singh',
  'Thomas',
  'Verma',
  'Yadav',
];

/** Staff ids: 5ea1f000-000P-4000-8000-00000000NNNN, P = pack number. */
export const demoStaffId = (pack: number, n: number) =>
  `5ea1f000-${String(pack).padStart(4, '0')}-4000-8000-${String(n).padStart(12, '0')}`;
/** Lead ids: 1ead0000-000P-4000-8000-00000000NNNN. */
export const demoLeadId = (pack: number, n: number) =>
  `1ead0000-${String(pack).padStart(4, '0')}-4000-8000-${String(n).padStart(12, '0')}`;
/** Each staff member's Supabase Auth user id (same digits as their staff id). */
export const demoAuthUserId = (staffIdValue: string) => `a17a0000${staffIdValue.slice(8)}`;
/** Demo phone numbers: the +91 70000 range, a block of 1000 per pack. */
export const demoPhone = (pack: number, n: number) => `+9170${String(pack * 1000 + 100 + n).padStart(8, '0')}`;

/** The accounts behind the CRM's "Sign in as" buttons, one per role, in role order. */
export function demoUsers(staff: readonly DemoStaffMember[]): { role: StaffRole; staffId: string }[] {
  return STAFF_ROLES.flatMap((role) => {
    const member = staff.find((m) => m.demoLogin && m.role === role);
    return member ? [{ role, staffId: member.id }] : [];
  });
}

/** A unique "First Last" name from the shared lists. */
export function uniqueName(r: Rng, used: Set<string>): string {
  let name: string;
  do name = `${r.pick(DEMO_FIRST_NAMES)} ${r.pick(DEMO_LAST_NAMES)}`;
  while (used.has(name));
  used.add(name);
  return name;
}

/** A placeholder email for a demo lead (example.com is reserved). */
export const demoEmail = (fullName: string) => `${fullName.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`;
