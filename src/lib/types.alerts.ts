export type LowCreditLog = {
	id: string;
	user_id: string;
	email?: string;
	credits_before?: number;
	credits_after?: number;
	status: 'sent' | 'skipped' | 'error';
	message?: string;
	created_at: string;
};


