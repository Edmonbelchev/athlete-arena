import { APP_VERSION_LABEL } from '@/constants/app';
import { assertSupabaseConfigured, supabase } from '@/lib/supabase';
import type { SupportTicket, SupportTicketCategory } from '@/types/support';

interface SupportTicketRpcRow {
  id: string;
  category: SupportTicketCategory;
  subject: string;
  message: string;
  status: SupportTicket['status'];
  app_version: string | null;
  created_at: string;
  updated_at: string;
}

function mapSupportTicket(row: SupportTicketRpcRow): SupportTicket {
  return {
    id: row.id,
    category: row.category,
    subject: row.subject,
    message: row.message,
    status: row.status,
    appVersion: row.app_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createSupportTicket(
  category: SupportTicketCategory,
  subject: string,
  message: string,
): Promise<SupportTicket> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('create_support_ticket', {
    p_category: category,
    p_subject: subject,
    p_message: message,
    p_app_version: APP_VERSION_LABEL,
  });

  if (error) {
    throw error;
  }

  return mapSupportTicket(data as SupportTicketRpcRow);
}

export async function getMySupportTickets(): Promise<SupportTicket[]> {
  assertSupabaseConfigured();

  const { data, error } = await supabase.rpc('get_my_support_tickets');

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapSupportTicket(row as SupportTicketRpcRow));
}
