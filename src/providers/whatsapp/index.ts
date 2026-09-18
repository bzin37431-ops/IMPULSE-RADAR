import crypto from 'node:crypto';
import { env, assertOfficialProvider, configuredProvider } from '../../config.js';

export type SendInput = { to: string; text?: string; templateName?: string; language?: string; idempotencyKey: string };
export type ProviderResult = { providerMessageId: string; status: 'SENT' | 'FAILED'; errorCode?: string; errorMessage?: string };
export interface WhatsAppProvider {
  sendTemplate(input: SendInput): Promise<ProviderResult>; sendText(input: SendInput): Promise<ProviderResult>; sendImage(input: SendInput): Promise<ProviderResult>; sendDocument(input: SendInput): Promise<ProviderResult>; sendInteractive(input: SendInput): Promise<ProviderResult>;
  getTemplates(): Promise<unknown[]>; getTemplateStatus(name: string): Promise<unknown>; markAsRead(messageId: string): Promise<void>; processWebhook(payload: unknown): Promise<void>; validateWebhookSignature(raw: Buffer, signature?: string): boolean; getMedia(mediaId: string): Promise<unknown>; getPhoneInfo(): Promise<unknown>;
}
export class OfficialApiGuard { constructor() {} assert() { assertOfficialProvider(); } }
export class MockWhatsAppProvider implements WhatsAppProvider {
  private result(): ProviderResult { return { providerMessageId: `mock-${crypto.randomUUID()}`, status: 'SENT' }; }
  async sendTemplate() { return this.result(); } async sendText() { return this.result(); } async sendImage() { return this.result(); } async sendDocument() { return this.result(); } async sendInteractive() { return this.result(); }
  async getTemplates() { return [{ name: 'impulse_apresentacao', status: 'APPROVED', language: 'pt_BR' }]; } async getTemplateStatus(name: string) { return { name, status: 'APPROVED' }; } async markAsRead() {} async processWebhook() {} async getMedia(mediaId: string) { return { mediaId, mode: 'mock' }; } async getPhoneInfo() { return { verified_name: 'Impulse Sites', display_phone_number: '+55 11 90000-0000' }; } validateWebhookSignature() { return true; }
}
export class MetaCloudApiProvider implements WhatsAppProvider {
  private guard = new OfficialApiGuard(); private base = `https://graph.facebook.com/${env.META_GRAPH_API_VERSION}`;
  private headers() { this.guard.assert(); if (!env.META_ACCESS_TOKEN) throw new Error('META_ACCESS_TOKEN não configurado.'); return { Authorization: `Bearer ${env.META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }; }
  async sendTemplate(input: SendInput) { return this.send({ messaging_product: 'whatsapp', to: input.to, type: 'template', template: { name: input.templateName, language: { code: input.language || 'pt_BR' } } }); }
  async sendText(input: SendInput) { return this.send({ messaging_product: 'whatsapp', to: input.to, type: 'text', text: { body: input.text } }); }
  async sendImage(input: SendInput) { return this.send({ messaging_product: 'whatsapp', to: input.to, type: 'image', image: { link: input.text } }); }
  async sendDocument(input: SendInput) { return this.send({ messaging_product: 'whatsapp', to: input.to, type: 'document', document: { link: input.text } }); }
  async sendInteractive(input: SendInput) { return this.send({ messaging_product: 'whatsapp', to: input.to, type: 'interactive', interactive: JSON.parse(input.text || '{}') }); }
  private async send(body: unknown): Promise<ProviderResult> { const response = await fetch(`${this.base}/${env.META_PHONE_NUMBER_ID}/messages`, { method: 'POST', headers: this.headers(), body: JSON.stringify(body) }); const data = await response.json() as { messages?: { id: string }[]; error?: { code: string; message: string } }; if (!response.ok) return { providerMessageId: '', status: 'FAILED', errorCode: data.error?.code, errorMessage: data.error?.message || `Meta HTTP ${response.status}` }; return { providerMessageId: data.messages?.[0]?.id || '', status: 'SENT' }; }
  async getTemplates() { const response = await fetch(`${this.base}/${env.META_WABA_ID}/message_templates`, { headers: this.headers() }); const payload = await response.json() as { data?: unknown[] }; return payload.data || []; }
  async getTemplateStatus(name: string) { const templates = await this.getTemplates() as Array<{ name: string }>; return templates.find((item) => item.name === name) || { name, status: 'NOT_FOUND' }; }
  async markAsRead(messageId: string) { await this.send({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }); }
  async processWebhook() { return; }
  async getMedia(mediaId: string) { const response = await fetch(`${this.base}/${mediaId}`, { headers: this.headers() }); return response.json(); }
  async getPhoneInfo() { const response = await fetch(`${this.base}/${env.META_PHONE_NUMBER_ID}?fields=display_phone_number,verified_name,quality_rating`, { headers: this.headers() }); return response.json(); }
  validateWebhookSignature(raw: Buffer, signature?: string) { if (!env.META_APP_SECRET || !signature) return false; const expected = 'sha256=' + crypto.createHmac('sha256', env.META_APP_SECRET).update(raw).digest('hex'); return expected.length === signature.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature)); }
}
export function createProvider(): WhatsAppProvider { return env.TEST_MODE ? new MockWhatsAppProvider() : new MetaCloudApiProvider(); }
