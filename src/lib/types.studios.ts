export type StudioKind = 'product' | 'apparel';

export type StudioTemplate = {
	id: string;
	name: string;
	description?: string;
};

export type StudioJobDraft = {
	template_id: string;
	images_count: number;
	variations: number;
	brand?: string;
	palette?: string;
	notes?: string;
	files?: File[];
};

export type StudioJobCreated = {
	id: string;
	status: 'queued' | 'processing' | 'done' | 'error';
};


