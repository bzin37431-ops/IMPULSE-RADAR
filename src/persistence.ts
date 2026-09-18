import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";
import { MemoryStore } from "./store.js";
import { Lead, History, Message } from "./domain.js";
import { ProspectBusiness, ProspectSearch, SavedLayout } from "./store.js";

export class PrismaPersistence {
  readonly prisma = new PrismaClient();
  async load(store: MemoryStore) {
    const leads = await this.prisma.lead.findMany({
      include: { consent: true, optOut: true },
    });
    for (const item of leads)
      store.leads.set(item.id, {
        id: item.id,
        name: item.name,
        company: item.company || undefined,
        phone: item.phone || undefined,
        normalizedPhone: item.normalizedPhone || undefined,
        email: item.email || undefined,
        instagram: item.instagram || undefined,
        googleMaps: item.googleMaps || undefined,
        site: item.site || undefined,
        city: item.city || undefined,
        state: item.state || undefined,
        niche: item.niche || undefined,
        source: item.source || undefined,
        observations: item.observations || undefined,
        nextFollowUpAt: item.nextFollowUpAt?.toISOString(),
        lastContactAt: item.lastContactAt?.toISOString(),
        siteModelSent: item.siteModelSent || undefined,
        proposedValue: item.proposedValue
          ? Number(item.proposedValue)
          : undefined,
        proposalDate: item.proposalDate?.toISOString(),
        status: item.status,
        assignedUserId: item.assignedUserId || undefined,
        consentStatus: item.consent?.status || "UNKNOWN",
        consentSource: item.consent?.source || undefined,
        consentDate: item.consent?.date?.toISOString(),
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      });
    const history = await this.prisma.leadHistory.findMany();
    store.histories.push(
      ...history.map((item) => ({
        id: item.id,
        leadId: item.leadId,
        type: item.type,
        details: typeof item.details === "string" ? item.details : undefined,
        userId: item.userId || undefined,
        createdAt: item.createdAt.toISOString(),
      })),
    );
    const templates = await this.prisma.template.findMany();
    if (templates.length)
      store.templates = templates.map((item) => ({
        id: item.id,
        name: item.name,
        language: item.language,
        category: item.category,
        status: item.status,
        updatedAt: item.updatedAt.toISOString(),
      }));
    const messages = await this.prisma.message.findMany();
    store.messages.push(
      ...messages.map((item) => ({
        id: item.id,
        conversationId: item.conversationId,
        providerMessageId: item.providerMessageId || undefined,
        direction: item.direction,
        type: item.type,
        content: item.content,
        templateName: item.templateName || undefined,
        status: item.status,
        idempotencyKey: item.idempotencyKey,
        createdAt: item.createdAt.toISOString(),
        errorMessage: item.errorMessage || undefined,
      })),
    );
    const campaigns = await this.prisma.campaign.findMany({
      include: { recipients: true },
    });
    store.campaigns.push(
      ...campaigns.map((item) => ({
        id: item.id,
        name: item.name,
        templateName: item.templateName,
        segment: item.segment as Record<string, string>,
        status: item.status,
        createdAt: item.createdAt.toISOString(),
        scheduledAt: item.scheduledAt?.toISOString(),
        createdBy: item.createdBy,
        recipientIds: item.recipients.map((recipient) => recipient.leadId),
      })),
    );
    const tasks = await this.prisma.task.findMany();
    store.tasks.push(
      ...tasks.map((item) => ({
        id: item.id,
        leadId: item.leadId,
        title: item.title,
        description: item.description || undefined,
        dueDate: item.dueDate?.toISOString(),
        assignedTo: item.assignedTo || undefined,
        completed: item.completed,
        createdAt: item.createdAt.toISOString(),
      })),
    );
    const searches = await this.prisma.prospectingSearch.findMany();
    const orphanCutoff = Date.now() - 15 * 60 * 1000;
    store.prospectingSearches.push(
      ...searches.map((item) => {
        const orphan =
          item.status === "RUNNING" &&
          (!item.lastHeartbeatAt ||
            item.lastHeartbeatAt.getTime() < orphanCutoff);
        return {
          id: item.id,
          userId: item.userId || undefined,
          state: item.state,
          city: item.city,
          district: item.district || undefined,
          niche: item.niche,
          sourceMode: item.sourceMode,
          digitalStatus: item.digitalStatus,
          minScore: item.minScore,
          quantity: item.quantity,
          coverageMode: item.coverageMode,
          status: orphan ? "INTERRUPTED" : item.status,
          progress: item.progress,
          providersConsulted: item.providersConsulted,
          uniqueResults: item.uniqueResults,
          noWebsiteCount: item.noWebsiteCount,
          socialOnlyCount: item.socialOnlyCount,
          websiteCount: item.websiteCount,
          errorMessage: orphan
            ? "Busca interrompida por ausência de heartbeat."
            : item.errorMessage || undefined,
          createdAt: item.createdAt.toISOString(),
          startedAt: item.startedAt?.toISOString(),
          lastHeartbeatAt: item.lastHeartbeatAt?.toISOString(),
          idempotencyKey: item.idempotencyKey || undefined,
          completedAt: item.completedAt?.toISOString(),
          cancelledAt: item.cancelledAt?.toISOString(),
          resultsCount: item.resultsCount,
        };
      }),
    );
    for (const item of store.prospectingSearches.filter(
      (search) => search.status === "INTERRUPTED",
    ))
      await this.prisma.prospectingSearch.update({
        where: { id: item.id },
        data: { status: "INTERRUPTED", errorMessage: item.errorMessage },
      });
    const businesses = await this.prisma.prospectBusiness.findMany();
    store.prospectBusinesses.push(
      ...businesses.map((item) => ({
        id: item.id,
        searchId: item.searchId,
        externalIds:
          (item.externalIds as Record<string, string> | null) || undefined,
        name: item.name,
        normalizedName: item.normalizedName,
        category: item.category || undefined,
        phone: item.phone || undefined,
        phoneSource: item.phoneSource || undefined,
        phoneSourceUrl: item.phoneSourceUrl || undefined,
        phoneVerifiedAt: item.phoneVerifiedAt?.toISOString(),
        normalizedPhone: item.normalizedPhone || undefined,
        whatsapp: item.whatsapp || undefined,
        email: item.email || undefined,
        instagram: item.instagram || undefined,
        facebook: item.facebook || undefined,
        tiktok: item.tiktok || undefined,
        linkedin: item.linkedin || undefined,
        website: item.website || undefined,
        domain: item.domain || undefined,
        mapsUrl: item.mapsUrl || undefined,
        address: item.address || undefined,
        district: item.district || undefined,
        city: item.city,
        state: item.state,
        postalCode: item.postalCode || undefined,
        latitude: item.latitude || undefined,
        longitude: item.longitude || undefined,
        rating: item.rating || undefined,
        reviewsCount: item.reviewsCount || undefined,
        digitalStatus: item.digitalStatus,
        digitalStatusConfidence: item.digitalStatusConfidence,
        websiteConfidence: item.websiteConfidence,
        socialConfidence: item.socialConfidence,
        phoneConfidence: item.phoneConfidence,
        opportunityScore: item.opportunityScore,
        scoreBreakdown:
          (item.scoreBreakdown as Record<string, number> | null) || undefined,
        sourceProviders: (item.sourceProviders as string[] | null) || undefined,
        favorite: item.favorite,
        discarded: item.discarded,
        discardReason: item.discardReason || undefined,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
        verifiedAt: item.verifiedAt?.toISOString(),
      })),
    );
    const layouts = await this.prisma.savedLayout.findMany();
    store.savedLayouts.push(
      ...layouts.map((item) => ({
        id: item.id,
        prospectBusinessId: item.prospectBusinessId,
        searchId: item.searchId,
        savedAt: item.savedAt.toISOString(),
        savedBy: item.savedBy || undefined,
        commercialStatus: item.commercialStatus,
        notes: item.notes || undefined,
        createdAt: item.createdAt.toISOString(),
        updatedAt: item.updatedAt.toISOString(),
      })),
    );
  }
  async saveLead(lead: Lead) {
    await this.prisma.lead.upsert({
      where: { id: lead.id },
      update: {
        name: lead.name,
        company: lead.company,
        phone: lead.phone,
        normalizedPhone: lead.normalizedPhone,
        email: lead.email,
        instagram: lead.instagram,
        googleMaps: lead.googleMaps,
        site: lead.site,
        city: lead.city,
        state: lead.state,
        niche: lead.niche,
        source: lead.source,
        observations: lead.observations,
        nextFollowUpAt: lead.nextFollowUpAt
          ? new Date(lead.nextFollowUpAt)
          : undefined,
        lastContactAt: lead.lastContactAt
          ? new Date(lead.lastContactAt)
          : undefined,
        siteModelSent: lead.siteModelSent,
        proposedValue: lead.proposedValue,
        proposalDate: lead.proposalDate
          ? new Date(lead.proposalDate)
          : undefined,
        status: lead.status as never,
        assignedUserId: lead.assignedUserId,
      },
      create: {
        id: lead.id,
        name: lead.name,
        company: lead.company,
        phone: lead.phone,
        normalizedPhone: lead.normalizedPhone,
        email: lead.email,
        instagram: lead.instagram,
        googleMaps: lead.googleMaps,
        site: lead.site,
        city: lead.city,
        state: lead.state,
        niche: lead.niche,
        source: lead.source,
        observations: lead.observations,
        nextFollowUpAt: lead.nextFollowUpAt
          ? new Date(lead.nextFollowUpAt)
          : undefined,
        lastContactAt: lead.lastContactAt
          ? new Date(lead.lastContactAt)
          : undefined,
        siteModelSent: lead.siteModelSent,
        proposedValue: lead.proposedValue,
        proposalDate: lead.proposalDate
          ? new Date(lead.proposalDate)
          : undefined,
        status: lead.status as never,
        assignedUserId: lead.assignedUserId,
      },
    });
    await this.prisma.consent.upsert({
      where: { leadId: lead.id },
      update: {
        status: lead.consentStatus as never,
        source: lead.consentSource,
        date: lead.consentDate ? new Date(lead.consentDate) : undefined,
      },
      create: {
        leadId: lead.id,
        status: lead.consentStatus as never,
        source: lead.consentSource,
        date: lead.consentDate ? new Date(lead.consentDate) : undefined,
      },
    });
    if (lead.consentStatus === "OPTED_OUT")
      await this.prisma.optOut.upsert({
        where: { leadId: lead.id },
        update: { reason: "Solicitação registrada" },
        create: { leadId: lead.id, reason: "Solicitação registrada" },
      });
    else await this.prisma.optOut.deleteMany({ where: { leadId: lead.id } });
  }
  async saveHistory(item: History) {
    await this.prisma.leadHistory.create({
      data: {
        id: item.id,
        leadId: item.leadId,
        type: item.type,
        details: item.details,
        userId: item.userId,
      } as never,
    });
  }
  async saveMessage(item: Message) {
    await this.prisma.conversation.upsert({
      where: { id: item.conversationId },
      update: { lastMessageAt: new Date(item.createdAt) },
      create: {
        id: item.conversationId,
        leadId: item.conversationId,
        lastMessageAt: new Date(item.createdAt),
      },
    });
    await this.prisma.message.upsert({
      where: { id: item.id },
      update: {
        status: item.status as never,
        providerMessageId: item.providerMessageId,
        errorMessage: item.errorMessage,
      },
      create: {
        id: item.id,
        conversationId: item.conversationId,
        providerMessageId: item.providerMessageId,
        direction: item.direction as never,
        type: item.type as never,
        content: item.content,
        templateName: item.templateName,
        status: item.status as never,
        idempotencyKey: item.idempotencyKey,
      },
    });
  }
  async saveCampaign(item: {
    id: string;
    name: string;
    templateName: string;
    segment: Record<string, string>;
    status: string;
    createdAt: string;
    scheduledAt?: string;
    createdBy: string;
    recipientIds: string[];
  }) {
    await this.prisma.campaign.upsert({
      where: { id: item.id },
      update: {
        status: item.status as never,
        scheduledAt: item.scheduledAt ? new Date(item.scheduledAt) : undefined,
      },
      create: {
        id: item.id,
        name: item.name,
        templateName: item.templateName,
        segment: item.segment,
        status: item.status as never,
        createdAt: new Date(item.createdAt),
        scheduledAt: item.scheduledAt ? new Date(item.scheduledAt) : undefined,
        createdBy: item.createdBy,
      },
    });
    await this.prisma.campaignRecipient.deleteMany({
      where: { campaignId: item.id },
    });
    if (item.recipientIds.length)
      await this.prisma.campaignRecipient.createMany({
        data: item.recipientIds.map((leadId) => ({
          id: crypto.randomUUID(),
          campaignId: item.id,
          leadId,
        })),
      });
  }
  async saveTask(item: {
    id: string;
    leadId: string;
    title: string;
    description?: string;
    dueDate?: string;
    assignedTo?: string;
    completed: boolean;
    createdAt: string;
  }) {
    await this.prisma.task.upsert({
      where: { id: item.id },
      update: {
        title: item.title,
        description: item.description,
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        assignedTo: item.assignedTo,
        completed: item.completed,
      },
      create: {
        id: item.id,
        leadId: item.leadId,
        title: item.title,
        description: item.description,
        dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
        assignedTo: item.assignedTo,
        completed: item.completed,
        createdAt: new Date(item.createdAt),
      },
    });
  }
  async deleteLead(id: string) {
    await this.prisma.lead.delete({ where: { id } });
  }
  async saveProspectSearch(item: ProspectSearch) {
    await this.prisma.prospectingSearch.upsert({
      where: { id: item.id },
      update: {
        userId: item.userId,
        status: item.status as never,
        progress: item.progress,
        providersConsulted: item.providersConsulted,
        uniqueResults: item.uniqueResults,
        noWebsiteCount: item.noWebsiteCount,
        socialOnlyCount: item.socialOnlyCount,
        websiteCount: item.websiteCount,
        errorMessage: item.errorMessage,
        startedAt: item.startedAt ? new Date(item.startedAt) : undefined,
        lastHeartbeatAt: item.lastHeartbeatAt
          ? new Date(item.lastHeartbeatAt)
          : undefined,
        idempotencyKey: item.idempotencyKey,
        completedAt: item.completedAt ? new Date(item.completedAt) : undefined,
        cancelledAt: item.cancelledAt ? new Date(item.cancelledAt) : undefined,
        resultsCount: item.resultsCount,
      },
      create: {
        id: item.id,
        userId: item.userId,
        state: item.state,
        city: item.city,
        district: item.district,
        niche: item.niche,
        sourceMode: item.sourceMode as never,
        digitalStatus: item.digitalStatus as never,
        minScore: item.minScore,
        quantity: item.quantity,
        coverageMode: item.coverageMode as never,
        status: item.status as never,
        progress: item.progress,
        providersConsulted: item.providersConsulted,
        uniqueResults: item.uniqueResults,
        noWebsiteCount: item.noWebsiteCount,
        socialOnlyCount: item.socialOnlyCount,
        websiteCount: item.websiteCount,
        errorMessage: item.errorMessage,
        createdAt: new Date(item.createdAt),
        startedAt: item.startedAt ? new Date(item.startedAt) : undefined,
        lastHeartbeatAt: item.lastHeartbeatAt
          ? new Date(item.lastHeartbeatAt)
          : undefined,
        idempotencyKey: item.idempotencyKey,
        completedAt: item.completedAt ? new Date(item.completedAt) : undefined,
        cancelledAt: item.cancelledAt ? new Date(item.cancelledAt) : undefined,
        resultsCount: item.resultsCount,
      },
    });
  }
  async deleteProspectSearch(id: string) {
    await this.prisma.prospectingSearch.delete({ where: { id } });
  }
  async saveProspectBusiness(item: ProspectBusiness) {
    await this.prisma.prospectBusiness.upsert({
      where: { id: item.id },
      update: {
        favorite: item.favorite,
        discarded: item.discarded,
        discardReason: item.discardReason,
        websiteConfidence: item.websiteConfidence,
        socialConfidence: item.socialConfidence,
        phoneConfidence: item.phoneConfidence,
        opportunityScore: item.opportunityScore,
        scoreBreakdown: item.scoreBreakdown,
        verifiedAt: item.verifiedAt ? new Date(item.verifiedAt) : undefined,
      },
      create: {
        id: item.id,
        searchId: item.searchId,
        externalIds: item.externalIds,
        name: item.name,
        normalizedName: item.normalizedName,
        category: item.category,
        phone: item.phone,
        phoneSource: item.phoneSource,
        phoneSourceUrl: item.phoneSourceUrl,
        phoneVerifiedAt: item.phoneVerifiedAt ? new Date(item.phoneVerifiedAt) : undefined,
        normalizedPhone: item.normalizedPhone,
        whatsapp: item.whatsapp,
        email: item.email,
        instagram: item.instagram,
        facebook: item.facebook,
        tiktok: item.tiktok,
        linkedin: item.linkedin,
        website: item.website,
        domain: item.domain,
        mapsUrl: item.mapsUrl,
        address: item.address,
        district: item.district,
        city: item.city,
        state: item.state,
        postalCode: item.postalCode,
        latitude: item.latitude,
        longitude: item.longitude,
        rating: item.rating,
        reviewsCount: item.reviewsCount,
        digitalStatus: item.digitalStatus as never,
        digitalStatusConfidence: item.digitalStatusConfidence,
        websiteConfidence: item.websiteConfidence,
        socialConfidence: item.socialConfidence,
        phoneConfidence: item.phoneConfidence,
        opportunityScore: item.opportunityScore,
        scoreBreakdown: item.scoreBreakdown,
        sourceProviders: item.sourceProviders,
        favorite: item.favorite,
        discarded: item.discarded,
        discardReason: item.discardReason,
        createdAt: new Date(item.createdAt),
        verifiedAt: item.verifiedAt ? new Date(item.verifiedAt) : undefined,
      },
    });
  }
  async saveSavedLayout(item: SavedLayout) {
    await this.prisma.savedLayout.upsert({
      where: { id: item.id },
      update: {
        commercialStatus: item.commercialStatus as never,
        notes: item.notes,
        savedBy: item.savedBy,
        updatedAt: new Date(item.updatedAt),
      },
      create: {
        id: item.id,
        prospectBusinessId: item.prospectBusinessId,
        searchId: item.searchId,
        savedAt: new Date(item.savedAt),
        savedBy: item.savedBy,
        commercialStatus: item.commercialStatus as never,
        notes: item.notes,
        createdAt: new Date(item.createdAt),
        updatedAt: new Date(item.updatedAt),
      },
    });
  }
  async deleteSavedLayout(id: string) {
    await this.prisma.savedLayout.delete({ where: { id } });
  }
  async close() {
    await this.prisma.$disconnect();
  }
}
