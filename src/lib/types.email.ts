export type EmailTemplate = {
	id: string;
	name: string;
	description?: string;
	exampleData?: Record<string, unknown>;
	path?: string;
	engine?: 'html' | 'mjml' | 'hbs' | 'react-email' | 'unknown';
};

export type RenderRequest = {
	templateId?: string;
	html?: string;
	data?: Record<string, unknown>;
};

export type RenderResponse = {
	html: string;
	notes?: string;
};


