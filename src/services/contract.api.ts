import { api } from './api';

export interface DigitalStamp {
  certificateId: string;
  status: string;
  signedBy: string;
  representative: string;
  authority: string;
  algorithm: string;
  signedAt: string;
  ipAddress: string;
  qrPayload: string;
}

export interface UserContract {
  userId: number;
  username: string;
  role: string;
  contractNumber: string;
  isSigned: boolean;
  signedAt: string | null;
  contractHash: string | null;
  signature?: string | null;
  publicKey?: string;
  rawPublicKey?: string;
  rawPrivateKey?: string;
  signerInfo: {
    name: string;
    email: string;
    phone: string;
    businessName: string;
    taxCode: string;
    address: string;
    locationType: string;
    latitude: number | null;
    longitude: number | null;
  };
  stamp: DigitalStamp | null;
}

export interface ContractDetailsResponse {
  success: boolean;
  contract: UserContract;
  canonicalText: string;
}

export interface ContractStatusResponse {
  success: boolean;
  isSigned: boolean;
  contractNumber: string | null;
  signedAt: string | null;
}

export interface SignContractPayload {
  privateKey: string;
  agreedTerms: boolean;
}

export interface SignContractResponse {
  success: boolean;
  message: string;
  contract: Partial<UserContract>;
}

export async function getMyContract(): Promise<ContractDetailsResponse> {
  const res = await api.get<ContractDetailsResponse>('/contracts/my-contract');
  return res.data;
}

export async function signContract(payload: SignContractPayload): Promise<SignContractResponse> {
  const res = await api.post<SignContractResponse>('/contracts/sign', payload);
  return res.data;
}

export async function getContractStatus(): Promise<ContractStatusResponse> {
  const res = await api.get<ContractStatusResponse>('/contracts/status');
  return res.data;
}
