/**
 * Synthetic people for the clinic demo. Every name is fictional and every
 * phone number sits in the +91 70000 000xx demo range. The doctors page and
 * the database seed both read from here, so they never drift apart.
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
  readonly specialties: readonly string[];
  readonly languages: readonly string[];
  readonly locations: readonly string[];
  readonly capacity: number;
  /** Clinicians appear on the public doctors page. */
  readonly clinician: boolean;
  readonly bio?: string;
}

const staffId = (n: number) => `5ea1f000-0000-4000-8000-${String(n).padStart(12, '0')}`;

export const clinicDemoStaff: readonly DemoStaffMember[] = [
  {
    id: staffId(1),
    fullName: 'Dr. Asha Raman',
    title: 'Senior consultant, general medicine',
    level: 'senior_consultant',
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
    specialties: [],
    languages: ['en', 'hi', 'ml'],
    locations: ['lakeside', 'riverside'],
    capacity: 35,
    clinician: false,
  },
];

export interface DemoLead {
  readonly id: string;
  readonly fullName: string;
  readonly phone: string;
  readonly email: string | null;
  readonly preferredLanguage: string;
  readonly stage: string;
  readonly urgency: 'low' | 'normal' | 'high' | 'urgent';
  readonly answers: Readonly<Record<string, string>>;
  readonly message: string | null;
  readonly assistantCallConsent: boolean;
  readonly assignedStaffId: string | null;
  /** Stage history after "new", oldest first. */
  readonly stageHistory: readonly string[];
  readonly createdDaysAgo: number;
}

const leadId = (n: number) => `1ead0000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const demoPhone = (n: number) => `+9170000000${String(n).padStart(2, '0')}`;

export const clinicDemoLeads: readonly DemoLead[] = [
  {
    id: leadId(1),
    fullName: 'Ananya Demo',
    phone: demoPhone(1),
    email: 'ananya.demo@example.com',
    preferredLanguage: 'en',
    stage: 'new',
    urgency: 'normal',
    answers: { concern_category: 'dermatology', preferred_time: 'evening', visit_type: 'first', has_insurance: 'no' },
    message: 'Would like a routine skin check before a family wedding.',
    assistantCallConsent: true,
    assignedStaffId: null,
    stageHistory: [],
    createdDaysAgo: 0,
  },
  {
    id: leadId(2),
    fullName: 'Rohan Sample',
    phone: demoPhone(2),
    email: null,
    preferredLanguage: 'hi',
    stage: 'new',
    urgency: 'normal',
    answers: { concern_category: 'not-sure', preferred_time: 'morning', visit_type: 'first', has_insurance: 'yes' },
    message: null,
    assistantCallConsent: false,
    assignedStaffId: null,
    stageHistory: [],
    createdDaysAgo: 1,
  },
  {
    id: leadId(3),
    fullName: 'Kavya Testwala',
    phone: demoPhone(3),
    email: 'kavya.test@example.com',
    preferredLanguage: 'en',
    stage: 'ai_triaged',
    urgency: 'high',
    answers: {
      concern_category: 'general-medicine',
      preferred_time: 'any',
      visit_type: 'follow-up',
      has_insurance: 'yes',
    },
    message: 'Follow-up on my annual check-up from last year.',
    assistantCallConsent: true,
    assignedStaffId: staffId(1),
    stageHistory: ['ai_triaged'],
    createdDaysAgo: 2,
  },
  {
    id: leadId(4),
    fullName: 'Imran Placeholder',
    phone: demoPhone(4),
    email: 'imran.placeholder@example.com',
    preferredLanguage: 'hi',
    stage: 'appointment_booked',
    urgency: 'normal',
    answers: { concern_category: 'dental', preferred_time: 'afternoon', visit_type: 'first', has_insurance: 'no' },
    message: 'Looking for a dental cleaning appointment.',
    assistantCallConsent: true,
    assignedStaffId: staffId(5),
    stageHistory: ['ai_triaged', 'appointment_booked'],
    createdDaysAgo: 4,
  },
  {
    id: leadId(5),
    fullName: 'Meenal Fictional',
    phone: demoPhone(5),
    email: null,
    preferredLanguage: 'en',
    stage: 'visited',
    urgency: 'low',
    answers: { concern_category: 'physiotherapy', preferred_time: 'evening', visit_type: 'first', has_insurance: 'no' },
    message: 'Want a desk-work posture routine.',
    assistantCallConsent: false,
    assignedStaffId: staffId(6),
    stageHistory: ['appointment_booked', 'visited'],
    createdDaysAgo: 9,
  },
  {
    id: leadId(6),
    fullName: 'Sunita Example',
    phone: demoPhone(6),
    email: 'sunita.example@example.com',
    preferredLanguage: 'hi',
    stage: 'follow_up_due',
    urgency: 'normal',
    answers: {
      concern_category: 'womens-health',
      preferred_time: 'morning',
      visit_type: 'follow-up',
      has_insurance: 'yes',
    },
    message: null,
    assistantCallConsent: true,
    assignedStaffId: staffId(7),
    stageHistory: ['appointment_booked', 'visited', 'follow_up_due'],
    createdDaysAgo: 16,
  },
  {
    id: leadId(7),
    fullName: 'Arvind Mockup',
    phone: demoPhone(7),
    email: 'arvind.mockup@example.com',
    preferredLanguage: 'en',
    stage: 'package_active',
    urgency: 'low',
    answers: { concern_category: 'general-medicine', preferred_time: 'any', visit_type: 'first', has_insurance: 'yes' },
    message: 'Interested in the everyday health check package.',
    assistantCallConsent: true,
    assignedStaffId: staffId(2),
    stageHistory: ['ai_triaged', 'appointment_booked', 'visited', 'package_active'],
    createdDaysAgo: 24,
  },
  {
    id: leadId(8),
    fullName: 'Pooja Synthetic',
    phone: demoPhone(8),
    email: null,
    preferredLanguage: 'en',
    stage: 'lost',
    urgency: 'normal',
    answers: { concern_category: 'diagnostics', preferred_time: 'afternoon', visit_type: 'first', has_insurance: 'no' },
    message: null,
    assistantCallConsent: false,
    assignedStaffId: staffId(9),
    stageHistory: ['lost'],
    createdDaysAgo: 30,
  },
];
