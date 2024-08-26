import * as path from 'path';
import { workspace, ExtensionContext, window } from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	ServerOptions,
	TransportKind,
	ErrorHandler,
	ErrorHandlerResult,
	CloseHandlerResult,
	CloseAction,
	ErrorAction
} from 'vscode-languageclient/node';

let langaugeClient: LanguageClient;

export function activate(context: ExtensionContext) {
	// The server is implemented in node
	let serverModule = context.asAbsolutePath(path.join('out', 'server.js'));
	// The debug options for the server
	// --inspect=6009: runs the server in Node's Inspector mode so VS Code can attach to the server for debugging
	let debugOptions = { execArgv: ['--nolazy', '--inspect=6009'] };

	// If the extension is launched in debug mode then the debug server options are used
	// Otherwise the run options are used
	let serverOptions: ServerOptions = {
		run: { module: serverModule, transport: TransportKind.ipc },
		debug: {
			module: serverModule,
			transport: TransportKind.ipc,
			options: debugOptions
		}
	};

	// Options to control the language client
	let clientOptions: LanguageClientOptions = {
		// Register the server for plain text documents
		documentSelector: [{ scheme: 'file', language: 'slake' }],
		synchronize: {
			// Notify the server about file changes to '.clientrc files contained in the workspace
			fileEvents: workspace.createFileSystemWatcher('**/.clientrc')
		},
		errorHandler: {
			error: async function (error, message, count): Promise<ErrorHandlerResult> {
				let result = await window.showErrorMessage("Error running Slake server:\n" + error.message);

				return {
					action: ErrorAction.Continue
				};
			},
			closed: async function (): Promise<CloseHandlerResult> {
				let result = await window.showErrorMessage("Slake server closed\n", "Restart");

				if (result === "Restart")
					return {
						action: CloseAction.Restart
					};
				return {
					action: CloseAction.DoNotRestart
				};
			}
		}
	};

	// Create the language client and start the client.
	langaugeClient = new LanguageClient(
		'slakeServer',
		'Slake language server',
		serverOptions,
		clientOptions
	);

	// Start the client. This will also launch the server
	return langaugeClient.start();
}

export function deactivate(): Thenable<void> | undefined {
	if (!langaugeClient) {
		return undefined;
	}
	return langaugeClient.stop();
}
