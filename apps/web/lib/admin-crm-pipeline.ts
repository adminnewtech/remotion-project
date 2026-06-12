import 'server-only';
import { getServerClient } from '@/lib/supabase/server';

export interface DealRow {
  id: string;
  dealNumber: string;
  title: string;
  value: number;
  stageId: string;
  stageName: string;
  stageColor: string;
  customerName: string | null;
  customerId: string | null;
  source: string | null;
  expectedClose: string | null;
  createdAt: string;
}

export interface StageData {
  id: string;
  name: string;
  position: number;
  color: string;
  winPct: number;
  isWon: boolean;
  isLost: boolean;
  deals: DealRow[];
  totalValue: number;
}

export interface PipelineData {
  live: boolean;
  pipelineId: string | null;
  pipelineName: string;
  stages: StageData[];
  totalDeals: number;
  totalPipelineValue: number;
  staff: { id: string; name: string }[];
}

export async function fetchPipeline(): Promise<PipelineData> {
  const sb = await getServerClient();

  const [{ data: pipeline }, { data: deals }, { data: staff }] = await Promise.all([
    sb
      ? sb
          .from('crm_pipelines')
          .select(`id, name, crm_stages(id, name, position, win_pct, color, is_won, is_lost)`)
          .eq('is_default', true)
          .single()
      : { data: null },
    sb
      ? sb
          .from('crm_deals')
          .select(`id, deal_number, title, value, stage_id, source, expected_close, created_at,
               profiles!crm_deals_customer_id_fkey(id, full_name)`)
          .order('created_at', { ascending: false })
      : { data: null },
    sb
      ? sb.from('profiles').select('id, full_name').in('role', ['admin', 'employee']).order('full_name')
      : { data: null },
  ]);

  if (!pipeline) {
    return samplePipelineData;
  }

  const stagesRaw = (
    pipeline as unknown as {
      id: string;
      name: string;
      crm_stages: {
        id: string;
        name: string;
        position: number;
        win_pct: number;
        color: string;
        is_won: boolean;
        is_lost: boolean;
      }[];
    }
  ).crm_stages ?? [];

  stagesRaw.sort((a, b) => a.position - b.position);

  const dealsRaw = (deals ?? []) as unknown as {
    id: string;
    deal_number: string;
    title: string;
    value: number;
    stage_id: string;
    source: string | null;
    expected_close: string | null;
    created_at: string;
    profiles: { id: string; full_name: string } | null;
  }[];

  const stages: StageData[] = stagesRaw.map((s) => {
    const stageDeals = dealsRaw
      .filter((d) => d.stage_id === s.id)
      .map((d) => ({
        id: d.id,
        dealNumber: d.deal_number,
        title: d.title,
        value: d.value,
        stageId: s.id,
        stageName: s.name,
        stageColor: s.color,
        customerName: d.profiles?.full_name ?? null,
        customerId: d.profiles?.id ?? null,
        source: d.source,
        expectedClose: d.expected_close,
        createdAt: d.created_at,
      }));
    return {
      id: s.id,
      name: s.name,
      position: s.position,
      color: s.color,
      winPct: s.win_pct,
      isWon: s.is_won,
      isLost: s.is_lost,
      deals: stageDeals,
      totalValue: stageDeals.reduce((sum, d) => sum + d.value, 0),
    };
  });

  return {
    live: true,
    pipelineId: (pipeline as { id: string }).id,
    pipelineName: (pipeline as { name: string }).name,
    stages,
    totalDeals: dealsRaw.length,
    totalPipelineValue: dealsRaw.reduce((s, d) => s + d.value, 0),
    staff: (staff ?? []).map((p) => ({ id: p.id, name: p.full_name })),
  };
}

const samplePipelineData: PipelineData = {
  live: false,
  pipelineId: null,
  pipelineName: 'مبيعات الجملة والمشاريع',
  stages: [
    {
      id: 's1',
      name: 'جديد',
      position: 0,
      color: '#6366f1',
      winPct: 5,
      isWon: false,
      isLost: false,
      deals: [
        {
          id: 'd1',
          dealNumber: 'DL-2001',
          title: 'مشروع تكييف فندق الخليج',
          value: 15000,
          stageId: 's1',
          stageName: 'جديد',
          stageColor: '#6366f1',
          customerName: 'شركة الخليج العقارية',
          customerId: null,
          source: 'whatsapp',
          expectedClose: '2026-08-01',
          createdAt: new Date().toISOString(),
        },
      ],
      totalValue: 15000,
    },
    {
      id: 's2',
      name: 'تواصل',
      position: 1,
      color: '#3b82f6',
      winPct: 20,
      isWon: false,
      isLost: false,
      deals: [],
      totalValue: 0,
    },
    {
      id: 's3',
      name: 'عرض سعر',
      position: 2,
      color: '#f59e0b',
      winPct: 40,
      isWon: false,
      isLost: false,
      deals: [],
      totalValue: 0,
    },
    {
      id: 's4',
      name: 'تفاوض',
      position: 3,
      color: '#f97316',
      winPct: 70,
      isWon: false,
      isLost: false,
      deals: [],
      totalValue: 0,
    },
    {
      id: 's5',
      name: 'فوز',
      position: 4,
      color: '#10b981',
      winPct: 100,
      isWon: true,
      isLost: false,
      deals: [],
      totalValue: 0,
    },
    {
      id: 's6',
      name: 'خسارة',
      position: 5,
      color: '#ef4444',
      winPct: 0,
      isWon: false,
      isLost: true,
      deals: [],
      totalValue: 0,
    },
  ],
  totalDeals: 1,
  totalPipelineValue: 15000,
  staff: [{ id: 'st1', name: 'أحمد الرشيدي' }],
};
