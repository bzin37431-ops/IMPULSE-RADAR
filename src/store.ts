import { Lead, History, Message, LeadStatus, now, normalizePhone, PIPELINE } from './domain.js';

function groupBy<T>(values: T[], key: (value: T) => string): Record<string, T[]> {
  return values.reduce<Record<string, T[]>>((groups, value) => {
    const name = key(value);
    (groups[name] ??= []).push(value);
    return groups;
  }, {});
}

export type StoredCampaign = { id: string; name: string; templateName: string; segment: Record<string, string>; status: string; createdAt: string; scheduledAt?: string; createdBy: string; recipientIds: string[] };
export type StoredTask = { id: string; leadId: string; title: string; description?: string; dueDate?: string; assignedTo?: string; completed: boolean; createdAt: string };

export class MemoryStore {
  constructor(testMode = true, private persistence?: { saveLead(lead: Lead): Promise<unknown>; saveHistory(item: History): Promise<unknown>; saveMessage(item: Message): Promise<unknown>; saveCampaign?(campaign: StoredCampaign): Promise<unknown>; saveTask?(task: StoredTask): Promise<unknown>; deleteLead?(id: string): Promise<unknown> }) { this.settings.testMode = testMode; }
  leads = new Map<string, Lead>();
  histories: History[] = [];
  messages: Message[] = [];
  campaigns: Array<{ id: string; name: string; templateName: string; segment: Record<string, string>; status: string; createdAt: string; scheduledAt?: string; createdBy: string; recipientIds: string[] }> = [];
  tasks: Array<{ id: string; leadId: string; title: string; description?: string; dueDate?: string; assignedTo?: string; completed: boolean; createdAt: string }> = [];
  templates = [{ id: 'tpl-1', name: 'impulse_apresentacao', language: 'pt_BR', category: 'MARKETING', status: 'APPROVED', updatedAt: now() }];
  settings = { provider: 'META WHATSAPP CLOUD API', providerMode: 'meta-cloud-api', connected: false, lastWebhook: null as string | null, lastQueueError: null as string | null, deadLetters: [] as Array<{ jobId: string; leadId: string; campaignId?: string; error?: string; attempts: number; failedAt: string }>, queuePaused: false, testMode: true, maxConcurrentRequests: 2, maxQueueSize: 1000, maxRetries: 3, retryBackoff: 1000, pauseOnFailureRate: .25 };
  createLead(input: Partial<Lead>) {
    const normalizedPhone = normalizePhone(input.phone ?? input.normalizedPhone);
    const duplicate = [...this.leads.values()].find((lead) => (normalizedPhone && lead.normalizedPhone === normalizedPhone) || (!!input.company && !!lead.company && lead.company.toLowerCase() === input.company.toLowerCase()) || (!!input.instagram && !!lead.instagram && lead.instagram.toLowerCase() === input.instagram.toLowerCase()));
    if (duplicate) return { duplicate };
    const lead: Lead = { id: crypto.randomUUID(), name: input.name?.trim() || 'Sem nome', company: input.company?.trim(), phone: input.phone, normalizedPhone, email: input.email, instagram: input.instagram, googleMaps: input.googleMaps, site: input.site, city: input.city, state: input.state, niche: input.niche, source: input.source || 'MANUAL', observations: input.observations, nextFollowUpAt: input.nextFollowUpAt, lastContactAt: input.lastContactAt, siteModelSent: input.siteModelSent, proposedValue: input.proposedValue, proposalDate: input.proposalDate, status: (input.status as LeadStatus) || 'NOVO', assignedUserId: input.assignedUserId, consentStatus: input.consentStatus || 'UNKNOWN', consentSource: input.consentSource, consentDate: input.consentDate, createdAt: now(), updatedAt: now() };
    this.leads.set(lead.id, lead); this.addHistory(lead.id, 'LEAD_CREATED'); void this.persistence?.saveLead(lead).catch(() => undefined); return { lead };
  }
  updateLead(id: string, patch: Partial<Lead>, userId = 'demo-admin') {
    const old = this.leads.get(id); if (!old) return;
    const updated = { ...old, ...patch, normalizedPhone: patch.phone ? normalizePhone(patch.phone) : old.normalizedPhone, updatedAt: now() };
    this.leads.set(id, updated);
    this.addHistory(id, patch.status && patch.status !== old.status ? 'STATUS_CHANGED' : 'LEAD_EDITED', patch.status && patch.status !== old.status ? `${old.status} -> ${patch.status}` : undefined, userId); void this.persistence?.saveLead(updated).catch(() => undefined);
    return updated;
  }
  deleteLead(id: string) { const deleted = this.leads.delete(id); if (deleted) { this.histories = this.histories.filter((item) => item.leadId !== id); this.messages = this.messages.filter((item) => item.conversationId !== id); void this.persistence?.deleteLead?.(id).catch(() => undefined); } return deleted; }
  addHistory(leadId: string, type: string, details?: string, userId = 'demo-admin') { const item = { id: crypto.randomUUID(), leadId, type, details, userId, createdAt: now() }; this.histories.push(item); void this.persistence?.saveHistory(item).catch(() => undefined); }
  addMessage(message: Omit<Message, 'id' | 'createdAt'>) { const existing = this.messages.find((item) => item.idempotencyKey === message.idempotencyKey); if (existing) return existing; const created = { ...message, id: crypto.randomUUID(), createdAt: now() }; this.messages.push(created); this.addHistory(message.conversationId, message.direction === 'INBOUND' ? 'MESSAGE_RECEIVED' : 'MESSAGE_SENT'); void this.persistence?.saveMessage(created).catch(() => undefined); return created; }
  updateMessage(id: string, patch: Partial<Message>) { const index = this.messages.findIndex((item) => item.id === id); if (index < 0) return; const updated = { ...this.messages[index], ...patch }; this.messages[index] = updated; void this.persistence?.saveMessage(updated).catch(() => undefined); return updated; }
  persistCampaign(campaign: StoredCampaign) { void this.persistence?.saveCampaign?.(campaign).catch(() => undefined); }
  persistTask(task: StoredTask) { void this.persistence?.saveTask?.(task).catch(() => undefined); }
  dashboard() {
    const values = [...this.leads.values()]; const count = (status: LeadStatus) => values.filter((lead) => lead.status === status).length;
    const byCity = groupBy(values, (lead) => lead.city || 'Sem cidade'); const byNiche = groupBy(values, (lead) => lead.niche || 'Sem nicho'); const today = new Date(); const startOfDay = new Date(today); startOfDay.setHours(0, 0, 0, 0); const endOfDay = new Date(today); endOfDay.setHours(23, 59, 59, 999); const followUps = { today: values.filter((lead) => lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) >= startOfDay && new Date(lead.nextFollowUpAt) <= endOfDay), overdue: values.filter((lead) => lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < startOfDay), upcoming: values.filter((lead) => lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) > endOfDay) };
    return { total: values.length, new: count('NOVO'), contacted: count('CONTATADO'), responded: count('RESPONDEU'), interested: count('INTERESSADO'), meetings: count('REUNIAO'), proposals: count('PROPOSTA'), clients: count('CLIENTE'), pipeline: PIPELINE.map((status) => ({ status, count: count(status) })), byCity: Object.entries(byCity).map(([label, items]) => ({ label, count: items.length })), byNiche: Object.entries(byNiche).map(([label, items]) => ({ label, count: items.length })), recent: this.histories.slice(-8).reverse(), followUps, integration: { provider: this.settings.provider, queuePaused: this.settings.queuePaused, testMode: this.settings.testMode, lastWebhook: this.settings.lastWebhook } };
  }
}
