declare global {
  interface Window {
    PaystackPop?: new () => {
      resumeTransaction: (accessCode: string) => void;
    };
  }
}

let paystackScriptPromise: Promise<void> | null = null;

function loadPaystackScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Paystack checkout can only load in the browser.'));
  }
  if (window.PaystackPop) return Promise.resolve();
  if (paystackScriptPromise) return paystackScriptPromise;

  paystackScriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-paystack-popup="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Could not load the Paystack checkout script.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v2/inline.js';
    script.async = true;
    script.dataset.paystackPopup = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the Paystack checkout script.'));
    document.head.appendChild(script);
  });

  return paystackScriptPromise;
}

export async function openPaystackCheckout(accessCode: string) {
  await loadPaystackScript();
  if (!window.PaystackPop) {
    throw new Error('Paystack checkout is not available in this build.');
  }
  const popup = new window.PaystackPop();
  popup.resumeTransaction(accessCode);
}
