import type { Handlers } from './proxy';
const noop = () => {};
let uid = 1;

export default class ReplProxy {
	iframe: HTMLIFrameElement;

	handlers: Handlers = {
		on_fetch_progress: noop,
		on_console: noop,
		on_error: noop,
		on_console_group: noop,
		on_console_group_collapsed: noop,
		on_console_group_end: noop,
		on_unhandled_rejection: noop
	};

	pending_cmds: Map<number, { resolve: (value: any) => void; reject: (value: any) => void }> =
		new Map();

	handle_event = (e: MessageEvent<any>) => this.handle_repl_message(e);

	constructor(iframe: HTMLIFrameElement, handlers: Handlers) {
		this.iframe = iframe;
		this.handlers = handlers;
	}

	iframe_command(action: string, args: any) {
		return new Promise((resolve, reject) => {
			const cmd_id = uid++;
			this.pending_cmds.set(cmd_id, { resolve, reject });
			this.iframe.contentWindow?.postMessage({ action, cmd_id, args }, '*');
		});
	}

	eval(script: string) {
		return this.iframe_command('eval', { script });
	}

	handle_repl_message(event: MessageEvent<any>) {
		if (event.source !== this.iframe.contentWindow) return;

		const { action, args } = event.data;

		switch (action) {
			case 'cmd_error':
			case 'cmd_ok':
				return this.handle_command_message(event.data);
			case 'fetch_progress':
				return this.handlers?.on_fetch_progress && this.handlers?.on_fetch_progress(args.remaining);
			case 'error':
				return this.handlers.on_error && this.handlers.on_error(event.data);
			case 'unhandledrejection':
				return (
					this.handlers.on_unhandled_rejection && this.handlers.on_unhandled_rejection(event.data)
				);
			case 'console':
				return this.handlers.on_console && this.handlers.on_console(event.data);
			case 'console_group':
				return this.handlers.on_console_group && this.handlers.on_console_group(event.data);
			case 'console_group_collapsed':
				return (
					this.handlers.on_console_group_collapsed &&
					this.handlers.on_console_group_collapsed(event.data)
				);
			case 'console_group_end':
				return this.handlers.on_console_group_end && this.handlers.on_console_group_end(event.data);
		}
	}

	handle_command_message(cmd_data: {
		action: string;
		cmd_id: number;
		message: string;
		stack: any;
		args: any;
	}) {
		let action = cmd_data.action;
		let id = cmd_data.cmd_id;
		let handler = this.pending_cmds.get(id);

		if (handler) {
			this.pending_cmds.delete(id);
			if (action === 'cmd_error') {
				let { message, stack } = cmd_data;
				let e = new Error(message);
				e.stack = stack;
				handler.reject(e);
			}

			if (action === 'cmd_ok') {
				handler.resolve(cmd_data.args);
			}
		} else {
			console.error('command not found', id, cmd_data, [...this.pending_cmds.keys()]);
		}
	}
}
