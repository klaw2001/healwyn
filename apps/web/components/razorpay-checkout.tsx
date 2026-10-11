'use client';

import { Button } from '@healwyn/ui';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { confirmCheckout } from '@/app/[industry]/pay/actions';

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: { error?: { code?: string } }) => void) => void;
    };
  }
}

function loadScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Razorpay Checkout did not load'));
    document.head.append(script);
  });
}

/** Opens Razorpay Checkout (test mode) for an order the server created. No personal data is prefilled. */
export function RazorpayCheckout({
  keyId,
  orderId,
  amountPaise,
  brandName,
  description,
  token,
  resultBase,
  label,
}: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  brandName: string;
  description: string;
  token: string;
  /** /pay?t=…&i=… to return to with the result. */
  resultBase: string;
  label: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'opening' | 'confirming' | 'error'>('idle');
  return (
    <div className="grid gap-3">
      <Button
        size="lg"
        disabled={state === 'opening' || state === 'confirming'}
        onClick={async () => {
          setState('opening');
          try {
            await loadScript();
            const checkout = new window.Razorpay!({
              key: keyId,
              order_id: orderId,
              amount: amountPaise,
              currency: 'INR',
              name: brandName,
              description: `${description} (TEST PAYMENT)`,
              handler: async (response: RazorpayResponse) => {
                setState('confirming');
                const result = await confirmCheckout(
                  token,
                  response.razorpay_order_id,
                  response.razorpay_payment_id,
                  response.razorpay_signature,
                );
                router.push(`${resultBase}&result=${result.ok ? 'paid' : 'pending'}`);
              },
              modal: { ondismiss: () => router.push(`${resultBase}&result=closed`) },
            });
            checkout.on('payment.failed', () => router.push(`${resultBase}&result=failed`));
            checkout.open();
            setState('idle');
          } catch {
            setState('error');
          }
        }}
      >
        {state === 'confirming' ? 'Confirming…' : label}
      </Button>
      {state === 'error' ? (
        <p role="alert" className="font-semibold text-danger">
          The payment window could not open. Check your connection and try again.
        </p>
      ) : null}
    </div>
  );
}
