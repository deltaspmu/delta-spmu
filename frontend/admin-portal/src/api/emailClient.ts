import axios, { type AxiosInstance } from 'axios';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const EMAIL_API_URL = import.meta.env.VITE_EMAIL_API_URL;
const EMAIL_API_KEY = import.meta.env.VITE_EMAIL_API_KEY;

const emailApi: AxiosInstance = axios.create({
  baseURL: EMAIL_API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': EMAIL_API_KEY,
  },
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Email {
  id: string;
  to: string;
  from: string;
  subject: string;
  body: string;
  direction: 'inbound' | 'outbound';
  status: string;
  read: boolean;
  archived: boolean;
  attachments?: EmailAttachment[];
  created_at: string;
  updated_at: string;
}

export interface EmailAttachment {
  filename: string;
  content_type: string;
  size: number;
  url: string;
}

export interface EmailAddress {
  id: string;
  email: string;
  name?: string;
  verified: boolean;
  created_at: string;
}

export interface SendEmailPayload {
  to: string;
  from: string;
  subject: string;
  body: string;
  attachments?: { filename: string; url: string; content_type?: string }[];
}

export interface EmailListParams {
  direction?: 'inbound' | 'outbound';
  status?: string;
  limit?: number;
  offset?: number;
}

export interface EmailUpdatePayload {
  status?: string;
  read?: boolean;
  archived?: boolean;
}

export interface PresignedUrlResponse {
  upload_url: string;
  file_url: string;
}

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

function handleError(error: unknown): never {
  if (axios.isAxiosError(error)) {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message;
    const status = error.response?.status;
    throw new Error(`Email API error (${status ?? 'network'}): ${message}`);
  }
  throw error;
}

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------

export async function getEmails(params?: EmailListParams): Promise<Email[]> {
  try {
    const res = await emailApi.get('/emails', { params });
    return res.data?.data ?? res.data;
  } catch (error) {
    handleError(error);
  }
}

export async function getEmail(id: string): Promise<Email> {
  try {
    const res = await emailApi.get(`/emails/${id}`);
    return res.data?.data ?? res.data;
  } catch (error) {
    handleError(error);
  }
}

export async function sendEmail(data: SendEmailPayload): Promise<Email> {
  try {
    const res = await emailApi.post('/emails', data);
    return res.data?.data ?? res.data;
  } catch (error) {
    handleError(error);
  }
}

export async function updateEmail(
  id: string,
  data: EmailUpdatePayload,
): Promise<Email> {
  try {
    const res = await emailApi.patch(`/emails/${id}`, data);
    return res.data?.data ?? res.data;
  } catch (error) {
    handleError(error);
  }
}

export async function deleteEmail(id: string): Promise<void> {
  try {
    await emailApi.delete(`/emails/${id}`);
  } catch (error) {
    handleError(error);
  }
}

// ---------------------------------------------------------------------------
// Email Addresses
// ---------------------------------------------------------------------------

export async function getEmailAddresses(): Promise<EmailAddress[]> {
  try {
    const res = await emailApi.get('/email-addresses');
    return res.data?.data ?? res.data;
  } catch (error) {
    handleError(error);
  }
}

export async function addEmailAddress(
  email: string,
  name?: string,
): Promise<EmailAddress> {
  try {
    const res = await emailApi.post('/email-addresses', { email, name });
    return res.data?.data ?? res.data;
  } catch (error) {
    handleError(error);
  }
}

export async function deleteEmailAddress(id: string): Promise<void> {
  try {
    await emailApi.delete(`/email-addresses/${id}`);
  } catch (error) {
    handleError(error);
  }
}

// ---------------------------------------------------------------------------
// Attachments
// ---------------------------------------------------------------------------

export async function getPresignedUrl(
  filename: string,
  contentType: string,
): Promise<PresignedUrlResponse> {
  try {
    const res = await emailApi.post('/attachments/presign', {
      filename,
      content_type: contentType,
    });
    return res.data?.data ?? res.data;
  } catch (error) {
    handleError(error);
  }
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default emailApi;
