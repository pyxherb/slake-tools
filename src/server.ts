import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	CompletionItemTag
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import * as scls from './scls';
import { Range } from 'vscode';

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
let documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;
let hasDiagnosticRelatedInformationCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
	let capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			completionProvider: {
				resolveProvider: true
			}
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface Settings {
	maxNumberOfProblems: number;
}

// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: Settings = { maxNumberOfProblems: 1000 };
let globalSettings: Settings = defaultSettings;

// Cache the settings of all open documents
let documentSettings: Map<string, Thenable<Settings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <Settings>(
			(change.settings.languageServerExample || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(documentUpdate);
});

function getDocumentSettings(resource: string): Thenable<Settings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'languageServerExample'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

documents.onDidOpen(e => {
	openDocument(e.document);
});

// Only keep settings for open documents
documents.onDidClose(e => {
	closeDocument(e.document);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	documentUpdate(change.document);
});

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VS Code
	connection.console.log('We received a file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(completion);

// This handler resolves additional information for the item selected in
// the completion list.
/*connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}
		return item;
	}
);*/

async function openDocument(textDocument: TextDocument): Promise<void> {
	documentSettings.delete(textDocument.uri);

	let request: scls.DocumentOpenRequest = {
		uri: textDocument.uri,
		languageId: textDocument.languageId,
		markupType: scls.ClientMarkupType.Markdown
	};
	let result: scls.ServerResponse = await scls.sendDocumentOpenRequest(request);

	switch (result.type) {
		case scls.ResponseType.DocumentOk: {
			break;
		}
		case scls.ResponseType.DocumentError:
			break;
	}
}

async function closeDocument(textDocument: TextDocument): Promise<void> {
	documentSettings.delete(textDocument.uri);

	let request: scls.DocumentCloseRequest = {
		uri: textDocument.uri
	};
	let result: scls.ServerResponse = await scls.sendDocumentCloseRequest(request);

	switch (result.type) {
		case scls.ResponseType.DocumentOk: {
			break;
		}
		case scls.ResponseType.DocumentError:
			break;
	}
}

async function documentUpdate(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	let settings = await getDocumentSettings(textDocument.uri);

	// The validator creates diagnostics for all uppercase words length 2 and more
	let problems = 0;
	let diagnostics: Diagnostic[] = [];

	let request: scls.DocumentUpdateRequest = {
		uri: textDocument.uri,
		content: textDocument.getText()
	};
	let result: scls.ServerResponse = await scls.sendDocumentUpdateRequest(request);

	switch (result.type) {
		case scls.ResponseType.DocumentOk: {
			let body: scls.DocumentOkResponseBody = result.body;

			if (body.compilerMessages) {
				for (let i of body.compilerMessages) {
					let diagnostic: Diagnostic = {
						range: {
							start: {
								line: i.location.line,
								character: i.location.column
							},
							end: {
								line: i.location.line,
								character: i.location.column
							}
						},
						message: i.message,
						severity: scls.toDiagnosticSeverity(i.type)
					};

					diagnostics.push(diagnostic);
				}
			}
			break;
		}
		case scls.ResponseType.DocumentError:
			break;
	}

	// Send the computed diagnostics to VS Code.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

async function completion(_textDocumentPosition: TextDocumentPositionParams): Promise<CompletionItem[]> {
	let request: scls.CompletionRequest = {
		uri: _textDocumentPosition.textDocument.uri,
		location: {
			line: _textDocumentPosition.position.line,
			column: _textDocumentPosition.position.character
		}
	};

	let result = await scls.sendCompletionRequest(request);

	switch (result.type) {
		case scls.ResponseType.Completion: {
			let body: scls.CompletionResponseBody = result.body;

			let items: CompletionItem[] = [];

			if (body.completionItems) {
				for (let i of body.completionItems) {
					items.push(
						{
							kind: scls.toVscodeCompletionItemType(i.type),

							label: i.label,
							detail: i.details,
							documentation: i.documentations,
							insertText: i.insertText,

							tags: i.deprecated ? [CompletionItemTag.Deprecated] : []
						}
					);
				}
			}

			console.log("body.completionItems: \n", body.completionItems, "\n");
			console.log("items: \n", items, "\n");

			return items;
		}
		case scls.ResponseType.DocumentError:
			break;
	}

	return [];
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
