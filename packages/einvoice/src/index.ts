// M17 einvoice: chi dinh nghia interface o GĐ0. Adapter that (MISA/Viettel/VNPT)
// va MockAdapter se lam o GĐ4, sau khi dnduy chon nha cung cap. M08/M11 KHONG
// import gi tu package nay (BR-44).
export interface EInvoiceIssueRequest {
  invoiceId: string;
  orderId: string;
  tenantId: string;
}

export interface EInvoiceIssueResult {
  lookupCode: string;
  providerInvoiceId: string;
  status: 'issued' | 'failed';
}

export interface EInvoiceProvider {
  readonly providerCode: string;
  issue(request: EInvoiceIssueRequest): Promise<EInvoiceIssueResult>;
}
