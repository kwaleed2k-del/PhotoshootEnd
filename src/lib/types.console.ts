export type ApiCatalogEntry = {
	path: string;
	methods?: string[];
};

export type ApiProbeResult = {
	path: string;
	method: 'GET' | 'HEAD';
	status: number | 'timeout' | 'network';
	ms: number;
	ok: boolean;
};


