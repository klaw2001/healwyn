'use client';

import { Badge, Button } from '@healwyn/ui';
import { useId, useState, useTransition } from 'react';
import { paymentLink } from '@/app/(app)/payment-actions';

export interface PaymentView {
  id: string;
  product: string;
  amount: string;
  status: 'created' | 'authorized' | 'paid' | 'failed';
  when: string;
  provider: string;
  failure: string | null;
}

const STATUS: Record<PaymentView['status'], { label: string; tone: 'teal' | 'neutral' | 'accent' }> = {
  created: { label: 'Started', tone: 'neutral' },
  authorized: { label: 'Authorised', tone: 'neutral' },
  paid: { label: 'Paid', tone: 'teal' },
  failed: { label: 'Failed', tone: 'accent' },
};

/** Test-mode payments for a lead, and a link to send them to pay. */
export function PaymentPanel({
  leadId,
  payments,
  products,
  canRequest,
}: {
  leadId: string;
  payments: PaymentView[];
  products: { id: string; label: string }[];
  canRequest: boolean;
}) {
  const id = useId();
  const [product, setProduct] = useState(products[0]?.id ?? '');
  const [link, setLink] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-3 text-sm">
      <p>
        <Badge tone="accent">Test mode</Badge>{' '}
        <span className="text-ink-muted">No real money moves. A paid payment moves the lead to the won stage.</span>
      </p>
      {payments.length ? (
        <ul className="grid gap-2">
          {payments.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {p.product} · {p.amount}
                <span className="block text-xs text-ink-muted">
                  {p.when} · {p.provider === 'simulated' ? 'simulated checkout' : 'Razorpay test'}
                  {p.failure ? ` · ${p.failure}` : ''}
                </span>
              </span>
              <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-ink-muted">No payments yet.</p>
      )}
      {canRequest && products.length ? (
        <div className="grid gap-2 border-t border-line pt-3">
          <label htmlFor={`${id}-product`} className="text-xs font-semibold text-ink-muted">
            Payment link for
          </label>
          <select
            id={`${id}-product`}
            value={product}
            onChange={(event) => setProduct(event.target.value)}
            className="min-h-10 rounded-md border border-line-strong bg-surface px-2"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await paymentLink(leadId, product || null);
                if (!result.ok) {
                  setMessage({ ok: false, text: result.error });
                  return;
                }
                setLink(result.url);
                try {
                  await navigator.clipboard.writeText(result.url);
                  setMessage({ ok: true, text: 'Test payment link copied. It works for 30 days.' });
                } catch {
                  setMessage({ ok: true, text: 'Test payment link ready. Copy it below. It works for 30 days.' });
                }
              })
            }
          >
            Copy test payment link
          </Button>
          {link ? (
            <input
              readOnly
              value={link}
              aria-label="Test payment link"
              onFocus={(event) => event.currentTarget.select()}
              className="min-h-10 rounded-md border border-line bg-surface-muted px-2 text-xs"
            />
          ) : null}
          {message ? (
            <p role={message.ok ? 'status' : 'alert'} className={message.ok ? '' : 'font-semibold text-danger'}>
              {message.text}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
