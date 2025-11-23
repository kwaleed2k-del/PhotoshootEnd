export type Me = {
	id: string;
	email: string;
	display_name?: string | null;
	billing_email?: string | null;
	stripe_customer_id?: string | null;
	user_metadata?: Record<string, unknown> | null;
};

export type MePatch = Partial<Pick<Me, 'display_name' | 'billing_email'>> & {
	email?: string;
};


