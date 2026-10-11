import { notFound } from 'next/navigation';

/** Any unknown address renders the industry's own not-found page (with its brand and navigation). */
export default function Missing() {
  notFound();
}
