import type { StaffRole } from '../permissions';

/**
 * Synthetic staff for the clinic demo. Every name is fictional. The doctors
 * page, the CRM's demo sign-in and the database seed all read from here, so
 * they never drift apart. Demo leads live in clinic-demo-leads.ts.
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
  /** Clinicians appear on the public doctors page. */
  readonly clinician: boolean;
  readonly bio?: string;
}

const staffId = (n: number) => `5ea1f000-0000-4000-8000-${String(n).padStart(12, '0')}`;
/** Each staff member's Supabase Auth user id (same number as their staff id). */
export const demoAuthUserId = (staffIdValue: string) => `a17a0000${staffIdValue.slice(8)}`;

export const clinicDemoStaff: readonly DemoStaffMember[] = [
  {
    id: staffId(1),
    fullName: 'Dr. Asha Raman',
    title: 'Senior consultant, general medicine',
    level: 'senior_consultant',
    role: 'specialist_doctor',
    specialties: ['general-medicine'],
    languages: ['en', 'hi', 'ta'],
    locations: ['lakeside'],
    capacity: 18,
    clinician: true,
    bio: 'Leads the general medicine team and makes sure every patient leaves knowing what happens next.',
  },
  {
    id: staffId(2),
    fullName: 'Dr. Vikram Sethi',
    title: 'Physician, general medicine',
    level: 'specialist_doctor',
    role: 'specialist_doctor',
    specialties: ['general-medicine'],
    languages: ['en', 'hi', 'pa'],
    locations: ['riverside'],
    capacity: 24,
    clinician: true,
    bio: 'Known for unhurried consultations and plain-language explanations.',
  },
  {
    id: staffId(3),
    fullName: 'Dr. Meera Kulkarni',
    title: 'Senior consultant, dermatology',
    level: 'senior_consultant',
    role: 'specialist_doctor',
    specialties: ['dermatology'],
    languages: ['en', 'hi', 'mr'],
    locations: ['riverside', 'lakeside'],
    capacity: 16,
    clinician: true,
    bio: 'Leads the dermatology team across both clinics.',
  },
  {
    id: staffId(4),
    fullName: 'Dr. Sana Mirza',
    title: 'Dermatologist',
    level: 'specialist_doctor',
    role: 'specialist_doctor',
    specialties: ['dermatology'],
    languages: ['en', 'hi', 'ur'],
    locations: ['lakeside'],
    capacity: 22,
    clinician: true,
    bio: 'Sees adults and teenagers, with a calm, step-by-step approach.',
  },
  {
    id: staffId(5),
    fullName: 'Dr. Farhan Qureshi',
    title: 'Dental surgeon',
    level: 'specialist_doctor',
    role: 'specialist_doctor',
    specialties: ['dental'],
    languages: ['en', 'hi'],
    locations: ['lakeside'],
    capacity: 20,
    clinician: true,
    bio: 'Especially good with nervous patients and first-time visitors.',
  },
  {
    id: staffId(6),
    fullName: 'Kabir Anand',
    title: 'Lead physiotherapist',
    level: 'specialist_doctor',
    role: 'specialist_doctor',
    specialties: ['physiotherapy'],
    languages: ['en', 'hi', 'kn'],
    locations: ['lakeside', 'riverside'],
    capacity: 26,
    clinician: true,
    bio: 'Builds simple routines that fit around work and family life.',
  },
  {
    id: staffId(7),
    fullName: 'Dr. Priya Iyer',
    title: 'Senior consultant, women’s health',
    level: 'senior_consultant',
    role: 'specialist_doctor',
    specialties: ['womens-health'],
    languages: ['en', 'hi', 'ta'],
    locations: ['lakeside', 'riverside'],
    capacity: 16,
    clinician: true,
    bio: 'Leads the women’s health team and its private consultation service.',
  },
  {
    id: staffId(8),
    fullName: 'Dr. Arjun Bhatt',
    title: 'Diagnostics lead',
    level: 'specialist_doctor',
    role: 'specialist_doctor',
    specialties: ['diagnostics'],
    languages: ['en', 'hi', 'gu'],
    locations: ['lakeside'],
    capacity: 30,
    clinician: true,
    bio: 'Makes sure every test result reaches the right doctor quickly.',
  },
  {
    id: staffId(9),
    fullName: 'Neha Joshi',
    title: 'Care coordinator',
    level: 'care_coordinator',
    role: 'care_coordinator',
    specialties: [],
    languages: ['en', 'hi', 'mr'],
    locations: ['riverside'],
    capacity: 40,
    clinician: false,
  },
  {
    id: staffId(10),
    fullName: 'Rahul Das',
    title: 'Care coordinator',
    level: 'care_coordinator',
    role: 'care_coordinator',
    specialties: [],
    languages: ['en', 'hi', 'bn'],
    locations: ['lakeside'],
    capacity: 40,
    clinician: false,
  },
  {
    id: staffId(11),
    fullName: 'Deepa Menon',
    title: 'Insurance and billing desk',
    level: 'billing_desk',
    role: 'billing_desk',
    specialties: [],
    languages: ['en', 'hi', 'ml'],
    locations: ['lakeside', 'riverside'],
    capacity: 35,
    clinician: false,
  },
  {
    id: staffId(12),
    fullName: 'Anita Kapoor',
    title: 'Clinic manager',
    level: 'clinic_manager',
    role: 'manager',
    specialties: [],
    languages: ['en', 'hi'],
    locations: ['lakeside', 'riverside'],
    capacity: 1,
    clinician: false,
  },
];

/** The account behind each "Sign in as" demo button, one per role. */
export const DEMO_USERS: readonly { role: StaffRole; staffId: string }[] = [
  { role: 'manager', staffId: staffId(12) },
  { role: 'care_coordinator', staffId: staffId(9) },
  { role: 'specialist_doctor', staffId: staffId(1) },
  { role: 'billing_desk', staffId: staffId(11) },
];
