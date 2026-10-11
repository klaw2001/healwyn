import { formatRupees, paymentFailureMessage, type IndustryPack } from '@healwyn/core';
import type { LeadPayment } from '@healwyn/db';
import { Button, buttonClasses, Container, RadioGroup } from '@healwyn/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeader } from '@/components/page-header';
import { RazorpayCheckout } from '@/components/razorpay-checkout';
import { pagePack } from '@/lib/pack';
import { loadBooking, type LoadedBooking } from '@/lib/server/booking';
import { getLeadStore } from '@/lib/server/lead-store';
import { errorFields, log } from '@/lib/server/log';
import { currentProvider } from '@/lib/server/payments';
import { simulateCheckout, startCheckout } from './actions';

export async function generateMetadata(props: PageProps<'/[industry]/pay'>): Promise<Metadata> {
  const pack = await pagePack(props);
  return {
    title: 'Test payment',
    description: `Pay for a ${pack.booking.noun} or a package (test mode: no real money moves).`,
    robots: { index: false, follow: false },
  };
}

const str = (value: string | string[] | undefined) => (typeof value === 'string' ? value : undefined);

const ERRORS: Record<string, string> = {
  choose: 'Please choose what you would like to pay for.',
  busy: 'You have started several payments in the last hour. Please try again later.',
  failed: 'Something went wrong and nothing was charged. Please try again in a few minutes.',
};

const dateFormat = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long' });

export default async function PayPage(props: PageProps<'/[industry]/pay'>) {
  const sitePack = await pagePack(props);
  const params = await props.searchParams;
  const token = str(params.t);
  let loaded: LoadedBooking | null = null;
  let payments: LeadPayment[] = [];
  let failed = false;
  if (token) {
    try {
      loaded = await loadBooking(token);
      if (loaded) payments = await getLeadStore().leadPayments(loaded.context.lead_id);
    } catch (error) {
      log.error('payment.page_failed', errorFields(error));
      failed = true;
    }
  }
  const pack = loaded?.pack ?? sitePack;

  return (
    <>
      <PageHeader
        eyebrow="Test payment"
        title="Pay online"
        intro={`Pay for a ${pack.booking.noun} or a package before you come in. In this demo every payment is a test: no real money moves.`}
      />
      <Container className="py-section">
        <div className="mx-auto grid max-w-3xl gap-8">
          <TestBanner />
          {!token || str(params.error) === 'link' || (!loaded && !failed) ? (
            <div className="rounded-xl border border-line bg-surface p-6 shadow-soft sm:p-10">
              {token || str(params.error) === 'link' ? (
                <p role="alert" className="mb-4 font-semibold text-danger">
                  This payment link is not valid or has expired.
                </p>
              ) : null}
              <p>
                Payments use the personal link you get after sending an enquiry. Send one first, then choose a time and
                pay from there.
              </p>
              <Link href="/contact" className={`${buttonClasses({ size: 'lg' })} mt-6`}>
                Send an enquiry
              </Link>
            </div>
          ) : failed || !loaded ? (
            <p role="alert" className="rounded-md border-2 border-danger bg-danger-soft p-4">
              {ERRORS.failed}
            </p>
          ) : (
            <Payment loaded={loaded} payments={payments} params={params} />
          )}
        </div>
      </Container>
    </>
  );
}

function TestBanner() {
  return (
    <div className="rounded-lg border-2 border-dashed border-accent bg-accent-soft p-5" role="note">
      <p className="font-display text-2xl font-semibold">Test payment</p>
      <p className="mt-1">
        This is a demo. Payments run in test mode and no real money moves. Never enter real card or bank details here.
      </p>
    </div>
  );
}

function Payment({
  loaded,
  payments,
  params,
}: {
  loaded: LoadedBooking;
  payments: LeadPayment[];
  params: Record<string, string | string[] | undefined>;
}) {
  const { pack, token } = loaded;
  const result = str(params.result);
  const error = str(params.error);
  const order = str(params.order);
  const latest = payments[0];
  const paid = payments.filter((p) => p.status === 'paid');
  const productName = (id: string) => pack.payments.products.find((p) => p.id === id)?.name ?? id;
  const pending = order ? payments.find((p) => p.status === 'created' || p.status === 'authorized') : undefined;

  return (
    <>
      {error && ERRORS[error] ? (
        <p role="alert" className="rounded-md border-2 border-danger bg-danger-soft p-4">
          {ERRORS[error]}
        </p>
      ) : null}
      {result === 'paid' && latest?.status === 'paid' ? (
        <p role="status" className="rounded-md border border-success bg-success-soft p-4">
          Test payment received: {productName(latest.product_id)}, {formatRupees(latest.amount_paise)}. Your{' '}
          {pack.booking.noun} team can see it now.
        </p>
      ) : null}
      {result === 'failed' || (result && latest?.status === 'failed') ? (
        <div role="alert" className="rounded-md border-2 border-danger bg-danger-soft p-4">
          <p className="font-semibold">The test payment did not go through. Nothing was charged.</p>
          <p className="mt-1">{paymentFailureMessage(latest?.failure_code)} You can try again below.</p>
        </div>
      ) : null}
      {result === 'closed' ? (
        <p role="status" className="rounded-md border border-line bg-surface p-4">
          The payment window was closed before paying. Nothing was charged. You can try again below.
        </p>
      ) : null}
      {result === 'pending' || (result === 'paid' && latest?.status !== 'paid') ? (
        <p role="status" className="rounded-md border border-line bg-surface p-4">
          We are waiting for the payment service to confirm. Refresh this page in a minute.
        </p>
      ) : null}

      {paid.length ? (
        <section aria-labelledby="paid-title" className="rounded-xl border border-line bg-surface p-6">
          <h2 id="paid-title" className="text-2xl">
            Paid (test)
          </h2>
          <ul className="mt-3 grid gap-2">
            {paid.map((p) => (
              <li key={p.id}>
                {productName(p.product_id)}, {formatRupees(p.amount_paise)}
                {p.paid_at ? ` on ${dateFormat.format(new Date(p.paid_at))}` : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {order && pending && pending.status === 'created' ? (
        <Checkout loaded={loaded} orderId={order} amountPaise={pending.amount_paise} productId={pending.product_id} />
      ) : (
        <ChooseProduct loaded={loaded} defaultProduct={str(params.product)} retry={latest?.status === 'failed'} />
      )}

      <p>
        <Link
          href={`/book?t=${encodeURIComponent(token)}&i=${pack.id}`}
          className="font-semibold text-primary underline underline-offset-4"
        >
          Back to your {pack.booking.noun}
        </Link>
      </p>
    </>
  );
}

function ChooseProduct({
  loaded,
  defaultProduct,
  retry,
}: {
  loaded: LoadedBooking;
  defaultProduct: string | undefined;
  retry: boolean;
}) {
  const { pack, token } = loaded;
  return (
    <form action={startCheckout} className="rounded-xl border border-line bg-surface p-6 shadow-soft sm:p-8">
      <input type="hidden" name="t" value={token} />
      <RadioGroup
        id="payment-product"
        name="product"
        legend="What would you like to pay for?"
        hint="Fictional prices for the demo. Nothing is charged."
        defaultValue={defaultProduct ?? pack.payments.products[0]?.id}
        options={pack.payments.products.map((p) => ({
          value: p.id,
          label: `${p.name}: ${formatRupees(p.amountPaise)}`,
          description: p.description,
        }))}
      />
      <Button type="submit" size="lg" className="mt-6 w-full sm:w-auto">
        {retry ? 'Try the test payment again' : 'Continue to test payment'}
      </Button>
    </form>
  );
}

function Checkout({
  loaded,
  orderId,
  amountPaise,
  productId,
}: {
  loaded: LoadedBooking;
  orderId: string;
  amountPaise: number;
  productId: string;
}) {
  const { pack, token } = loaded;
  const product = pack.payments.products.find((p) => p.id === productId);
  const provider = currentProvider();
  const label = `Pay ${formatRupees(amountPaise)} (test payment)`;
  return (
    <section
      aria-labelledby="checkout-title"
      className="rounded-xl border border-line bg-surface p-6 shadow-soft sm:p-8"
    >
      <h2 id="checkout-title" className="text-2xl">
        {product?.name ?? 'Payment'}: {formatRupees(amountPaise)}
      </h2>
      <p className="mt-2 text-ink-muted">{product?.description}</p>
      {provider === 'razorpay' ? (
        <div className="mt-6 grid gap-3">
          <p>
            Razorpay opens in a window. In test mode, use one of Razorpay&rsquo;s test cards or test UPI ids; no money
            moves.
          </p>
          <RazorpayCheckout
            keyId={process.env.RAZORPAY_KEY_ID ?? ''}
            orderId={orderId}
            amountPaise={amountPaise}
            brandName={pack.brand.name}
            description={product?.name ?? 'Payment'}
            token={token}
            resultBase={`/pay?t=${encodeURIComponent(token)}&i=${pack.id}`}
            label={label}
          />
        </div>
      ) : (
        <SimulatedCheckout pack={pack} token={token} orderId={orderId} label={label} />
      )}
    </section>
  );
}

function SimulatedCheckout({
  pack,
  token,
  orderId,
  label,
}: {
  pack: IndustryPack;
  token: string;
  orderId: string;
  label: string;
}) {
  return (
    <div className="mt-6 grid gap-3">
      <p>
        Simulated checkout: Razorpay test keys are not set up for this demo, so this stands in for the payment window.
        It sends the same signed payment event a real payment would.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <form action={simulateCheckout}>
          <input type="hidden" name="t" value={token} />
          <input type="hidden" name="order" value={orderId} />
          <input type="hidden" name="outcome" value="paid" />
          <Button type="submit" size="lg" className="w-full sm:w-auto">
            {label}
          </Button>
        </form>
        <form action={simulateCheckout}>
          <input type="hidden" name="t" value={token} />
          <input type="hidden" name="order" value={orderId} />
          <input type="hidden" name="outcome" value="failed" />
          <Button type="submit" size="lg" variant="secondary" className="w-full sm:w-auto">
            Decline (see what a failed payment looks like)
          </Button>
        </form>
      </div>
      <p className="text-sm text-ink-muted">{pack.brand.name} is fictional. Nothing is charged either way.</p>
    </div>
  );
}
