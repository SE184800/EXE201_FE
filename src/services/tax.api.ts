import { api } from './api';

export interface TaxBusinessInfo {
  taxCode: string;
  businessName: string;
  representative: string;
  address: string;
  businessType: string;
  status: string;
  issuedDate: string;
  taxAuthority: string;
}

export interface TaxLookupResponse {
  verified: boolean;
  source: string;
  data: TaxBusinessInfo;
}

export async function lookupTaxCode(taxCode: string): Promise<TaxLookupResponse> {
  const clean = taxCode.trim().replace(/\s+/g, '');
  const { data } = await api.get<TaxLookupResponse>(`/tax/lookup/${encodeURIComponent(clean)}`);
  return data;
}
