import { api } from './api';

export type AddressVerifyResponse = {
  verified: boolean;
  status: 'success' | 'not_found' | 'error';
  lat: number | null;
  lon: number | null;
  displayName: string | null;
  message: string;
};

export async function verifyAddressWithBackend(address: string): Promise<AddressVerifyResponse> {
  const { data } = await api.get<AddressVerifyResponse>('/profile/verify-address', {
    params: { q: address.trim() },
    timeout: 15_000,
  });
  return data;
}
