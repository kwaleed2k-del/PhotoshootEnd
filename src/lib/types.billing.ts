export type CreditPackage = {
	id: string;
	name: string;
	credits: number;
	price_minor: number;
	stripe_price_id: string;
	is_active: boolean;
};

export type InvoiceStatus = 'paid' | 'open' | 'draft' | 'void' | 'uncollectible';

export type Invoice = {
	id: string;
	number?: string | null;
	created_at?: string;
	amount_due_minor?: number;
	currency?: string | null;
	status: InvoiceStatus;
	hosted_invoice_url?: string | null;
	invoice_pdf?: string | null;
};

export type InvoicesPage = {
	data: Invoice[];
	next_cursor?: string | null;
};

export type Balance = {
	credits: number;
};


