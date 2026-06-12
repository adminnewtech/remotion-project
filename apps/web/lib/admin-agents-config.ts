// Shared agent config — no server-only, safe to import from client components.

export interface AgentConfig {
  key: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
  descEn: string;
  functionName: string;
}

export interface AgentStats {
  key: string;
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  failed: number;
}

export interface EvalSummary {
  total: number;
  passed: number;
  lastRunAt: string | null;
}

export interface AgentsData {
  live: boolean;
  killSwitches: Record<string, boolean>;
  stats: AgentStats[];
  evalSummary: EvalSummary;
  recentActions: RecentAction[];
}

export interface RecentAction {
  id: string;
  agent: string;
  tool: string;
  status: string;
  risk: string;
  createdAt: string;
}

export const AGENT_CONFIGS: AgentConfig[] = [
  {
    key: 'sales_agent',
    nameAr: 'وكيل المبيعات',
    nameEn: 'Sales Agent',
    descAr: 'يرد على رسائل واتساب ويساعد في إتمام المبيعات',
    descEn: 'Handles WhatsApp inquiries and guides customers to purchase',
    functionName: 'agent-sales',
  },
  {
    key: 'triage_agent',
    nameAr: 'وكيل التصنيف',
    nameEn: 'Triage Agent',
    descAr: 'يصنف تذاكر الدعم ويقترح ردوداً مسودة',
    descEn: 'Auto-classifies support tickets and drafts replies',
    functionName: 'agent-triage',
  },
  {
    key: 'copilot',
    nameAr: 'المساعد الذكي',
    nameEn: 'AI Copilot',
    descAr: 'مساعد العمليات الداخلي — يجيب على استفسارات الفريق',
    descEn: 'Ops copilot for staff queries with tool-use and HITL',
    functionName: 'ai-copilot',
  },
  {
    key: 'daily_report',
    nameAr: 'التقرير اليومي',
    nameEn: 'Daily Report',
    descAr: 'يولد تقريراً يومياً بالأداء والتنبيهات',
    descEn: 'Generates daily performance brief with anomaly detection',
    functionName: 'daily-report',
  },
  {
    key: 'accounting_poster',
    nameAr: 'ترحيل المحاسبة',
    nameEn: 'Accounting Poster',
    descAr: 'يرحل القيود المفوتة إلى دفتر الأستاذ تلقائياً',
    descEn: 'Auto-posts missed journal entries for completed orders',
    functionName: 'accounting-poster',
  },
];
