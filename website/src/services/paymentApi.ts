export interface ClientCreditPackage {
  id: string;
  name: string;
  credits: number;
  amountPaise: number;
  currency: string;
  isTest?: boolean;
}

export interface PaymentOrderResponse {
  success: boolean;
  orderId: string;
  amount: number;
  amountPaise: number;
  currency: string;
  keyId: string;
  packageId: string;
  credits: number;
}

export interface VerifyPaymentResponse {
  success: boolean;
  orderId: string;
  paymentId: string;
  status: string;
  creditsAwarded: number;
  newBalance?: number;
  alreadyVerified?: boolean;
}

const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname.includes('meooow.tech')) {
    return 'https://api.meooow.tech';
  }
  return 'http://localhost:4000';
};

const API_BASE_URL = getApiBaseUrl();

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');

  let data: any = null;
  if (isJson) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMessage =
      (isJson && data?.message) ||
      (isJson && data?.error) ||
      (typeof data === 'string' && data) ||
      `Request failed with status ${response.status}`;

    const error: any = new Error(errorMessage);
    error.status = response.status;
    error.code = data?.error;
    throw error;
  }

  return data as T;
}

export const paymentApi = {
  async getPackages(token: string): Promise<ClientCreditPackage[]> {
    const response = await fetch(`${API_BASE_URL}/api/payments/packages`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const result = await handleResponse<{ packages: ClientCreditPackage[] }>(response);
    return result.packages;
  },

  async createOrder(token: string, packageId: string): Promise<PaymentOrderResponse> {
    const response = await fetch(`${API_BASE_URL}/api/payments/razorpay/order`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ packageId }),
    });
    return await handleResponse<PaymentOrderResponse>(response);
  },

  async verifyPayment(
    token: string,
    params: { orderId: string; paymentId: string; signature: string }
  ): Promise<VerifyPaymentResponse> {
    const response = await fetch(`${API_BASE_URL}/api/payments/razorpay/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(params),
    });
    return await handleResponse<VerifyPaymentResponse>(response);
  },
};

