export type AdminLowCreditLog = {
	id: string;
	user_id: string;
	email?: string;
	credits_before?: number;
	credits_after?: number;
	status: 'sent' | 'skipped' | 'error';
	message?: string;
	created_at: string;
};

export type TestEmailResult = {
	ok: boolean;
	message?: string;
};


