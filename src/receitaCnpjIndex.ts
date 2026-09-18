import { PrismaClient } from '@prisma/client';

export type ReceitaCnpjRecord = { cnpj: string; businessName: string; tradeName?: string; status: string; cnae?: string; street?: string; number?: string; district?: string; city: string; state: string; postalCode?: string; phone1?: string; phone2?: string; email?: string };
const prisma = new PrismaClient();
const normalize = (value?: string) => (value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const normalizeStatus = (value: string) => /ATIV|02|ACTIVE/i.test(value) ? 'ATIVA' : value.toUpperCase();

export class ReceitaCnpjIndexService {
  async importRecords(records: ReceitaCnpjRecord[]) {
    for (let offset = 0; offset < records.length; offset += 500) {
      const batch = records.slice(offset, offset + 500);
      await prisma.$transaction(batch.map((record) => prisma.cnpjEstablishmentIndex.upsert({
        where: { cnpj: record.cnpj.replace(/\D/g, '') },
        create: this.data(record),
        update: this.data(record),
      })));
    }
    return records.length;
  }
  async count() { return prisma.cnpjEstablishmentIndex.count(); }
  private data(record: ReceitaCnpjRecord) { return { cnpj: record.cnpj.replace(/\D/g, ''), businessName: record.businessName, normalizedBusinessName: normalize(record.businessName), tradeName: record.tradeName || null, normalizedTradeName: record.tradeName ? normalize(record.tradeName) : null, status: normalizeStatus(record.status), cnae: record.cnae || null, street: record.street || null, number: record.number || null, district: record.district || null, city: record.city, state: record.state, postalCode: record.postalCode || null, phone1: record.phone1 || null, phone2: record.phone2 || null, email: record.email || null }; }
}
