import type { PartnerRules } from '../services/partnerConfigService';

declare global {
  namespace Express {
    interface Request {
      /** Set by API key auth after successful Bearer validation. */
      partnerId?: string;
      /** Correlation id for logs and error responses. */
      requestId?: string;
      /** Partner rules loaded for the authenticated partner (MCP invoke path). */
      partnerRules?: PartnerRules;
    }
  }
}

export {};
