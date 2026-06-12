import 'server-only';
import { getServerClient } from '@/lib/supabase/server';

export interface ThreadRow {
  phone: string;
  customerName: string | null;
  customerId: string | null;
  lastMessage: string;
  lastAt: string;
  unreadCount: number;
  windowOpen: boolean;
  ticketId: string | null;
  ticketStatus: string | null;
}

export interface InboxData {
  live: boolean;
  threads: ThreadRow[];
  totalUnread: number;
  templates: { name: string; body: string; params: number; category: string }[];
}

export async function fetchInbox(): Promise<InboxData> {
  const sb = await getServerClient();

  const [{ data: msgs }, { data: templates }] = await Promise.all([
    sb
      ? sb
          .from('wa_messages')
          .select('phone, body, direction, status, created_at, customer_id, ticket_id, profiles(full_name)')
          .order('created_at', { ascending: false })
          .limit(500)
      : { data: null },
    sb
      ? sb.from('wa_templates').select('name, body, params, category').eq('is_active', true).order('name')
      : { data: null },
  ]);

  if (!msgs) {
    return {
      live: false,
      threads: sampleThreads,
      totalUnread: 3,
      templates: [],
    };
  }

  // Group by phone — latest message per thread
  const phoneMap = new Map<string, ThreadRow>();
  const now = Date.now();

  for (const m of msgs as unknown as {
    phone: string;
    body: string | null;
    direction: string;
    status: string;
    created_at: string;
    customer_id: string | null;
    ticket_id: string | null;
    profiles: { full_name: string } | null;
  }[]) {
    if (!phoneMap.has(m.phone)) {
      const msgTime = new Date(m.created_at).getTime();
      phoneMap.set(m.phone, {
        phone: m.phone,
        customerName: m.profiles?.full_name ?? null,
        customerId: m.customer_id,
        lastMessage: m.body ?? '',
        lastAt: m.created_at,
        unreadCount: m.direction === 'in' && m.status === 'received' ? 1 : 0,
        windowOpen: m.direction === 'in' && now - msgTime < 24 * 60 * 60 * 1000,
        ticketId: m.ticket_id,
        ticketStatus: null,
      });
    } else if (m.direction === 'in' && m.status === 'received') {
      const existing = phoneMap.get(m.phone)!;
      phoneMap.set(m.phone, { ...existing, unreadCount: existing.unreadCount + 1 });
    }
  }

  const threads = Array.from(phoneMap.values()).sort(
    (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
  );

  return {
    live: true,
    threads,
    totalUnread: threads.reduce((s, t) => s + t.unreadCount, 0),
    templates: templates ?? [],
  };
}

const sampleThreads: ThreadRow[] = [
  {
    phone: '96512345678',
    customerName: 'فهد العنزي',
    customerId: null,
    lastMessage: 'أبي مكيف 1.5 طن',
    lastAt: new Date().toISOString(),
    unreadCount: 2,
    windowOpen: true,
    ticketId: null,
    ticketStatus: null,
  },
  {
    phone: '96598765432',
    customerName: 'نورة الشمري',
    customerId: null,
    lastMessage: 'متى يوصل طلبي؟',
    lastAt: new Date(Date.now() - 3600000).toISOString(),
    unreadCount: 1,
    windowOpen: false,
    ticketId: null,
    ticketStatus: null,
  },
];
