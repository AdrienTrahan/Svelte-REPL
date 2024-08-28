import type { Plugin } from '@rollup/browser';

export default {
	name: 'json',
	transform: (code, id) => {
		if (!id.endsWith('.json')) return;

		return {
			code: `export default ${code};`,
			map: null
		};
	}
} as Plugin;
