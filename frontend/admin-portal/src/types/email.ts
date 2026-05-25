// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------
export interface Email {
  name: string;
  subject: string;
  sender: string;
  sender_name: string;
  recipients: string[];
  cc: string[];
  bcc: string[];
  body: string;
  text_content: string;
  status: 'Draft' | 'Sent' | 'Failed' | 'Queued';
  read: boolean;
  starred: boolean;
  thread_id: string | null;
  attachments: EmailAttachment[];
  creation: string;
  modified: string;
}

// ---------------------------------------------------------------------------
// Email Contact
// ---------------------------------------------------------------------------
export interface EmailContact {
  name: string;
  email: string;
  full_name: string;
  user_image: string | null;
  group: string | null;
  tags: string[];
  is_student: boolean;
  last_emailed: string | null;
  creation: string;
}

// ---------------------------------------------------------------------------
// Email Thread
// ---------------------------------------------------------------------------
export interface EmailThread {
  thread_id: string;
  subject: string;
  participants: string[];
  last_message: string;
  last_message_date: string;
  message_count: number;
  unread_count: number;
  emails: Email[];
}

// ---------------------------------------------------------------------------
// Email Attachment
// ---------------------------------------------------------------------------
export interface EmailAttachment {
  name: string;
  file_name: string;
  file_url: string;
  file_size: number;
  content_type: string;
}

// ---------------------------------------------------------------------------
// Email Compose
// ---------------------------------------------------------------------------
export interface EmailCompose {
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  body: string;
  attachments: File[];
  reply_to: string | null;
  thread_id: string | null;
  template: string | null;
}
