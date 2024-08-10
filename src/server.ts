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
	CompletionItemTag,
	DocumentHighlightParams,
	DocumentHighlight,
	SemanticTokensParams,
	SemanticTokens,
	uinteger,
	SemanticTokenTypes,
	HoverParams,
	Hover
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
				resolveProvider: true,
				triggerCharacters: ['.']
			},
			semanticTokensProvider: {
				legend: {
					tokenTypes: scls.vscodeSemanticTokenTypes as SemanticTokenTypes[],
					tokenModifiers: scls.vscodeSemanticTokenModifiers
				},
				range: false,
				full: {
					delta: false
				}
			},
			hoverProvider: true
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
	documents.all().forEach(updateDocument);
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
	onDocumentOpen(e.document);
});

// Only keep settings for open documents
documents.onDidClose(e => {
	onDocumentClose(e.document);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	updateDocument(change.document);
});

connection.onDidChangeWatchedFiles(_change => {
	// Monitored files have change in VS Code
	connection.console.log('We received a file change event');
});

// This handler provides the initial list of the completion items.
connection.onCompletion(onCompletion);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve(
	(item: CompletionItem): CompletionItem => {
		/*if (item.data === 1) {
			item.detail = 'TypeScript details';
			item.documentation = 'TypeScript documentation';
		} else if (item.data === 2) {
			item.detail = 'JavaScript details';
			item.documentation = 'JavaScript documentation';
		}*/
		return item;
	}
);

connection.languages.semanticTokens.on(onSemanticTokens);
connection.onHover(onHover);

async function onDocumentOpen(textDocument: TextDocument): Promise<void> {
	documentSettings.delete(textDocument.uri);

	let request: scls.DocumentOpenRequest = {
		uri: textDocument.uri,
		content: textDocument.getText(),
		languageId: textDocument.languageId,
		markupType: scls.ClientMarkupType.Markdown
	};
	let response: scls.ServerResponse = await scls.sendDocumentOpenRequest(request);

	let diagnostics: Diagnostic[] = [];

	switch (response.type) {
		case scls.ResponseType.DocumentOk: {
			let body: scls.DocumentOkResponseBody = response.body;

			if (body.compilerMessages) {
				for (let i of body.compilerMessages) {
					diagnostics.push(scls.toVscodeDiagnostic(i));
				}
			}
			break;
		}
		case scls.ResponseType.DocumentError:
			break;
	}

	// Send the computed diagnostics to VS Code.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });

	connection.languages.semanticTokens.refresh();
}

async function onDocumentClose(textDocument: TextDocument): Promise<void> {
	documentSettings.delete(textDocument.uri);

	let request: scls.DocumentCloseRequest = {
		uri: textDocument.uri
	};
	let response: scls.ServerResponse = await scls.sendDocumentCloseRequest(request);

	switch (response.type) {
		case scls.ResponseType.DocumentOk: {
			break;
		}
		case scls.ResponseType.DocumentError:
			break;
	}
}

async function updateDocument(textDocument: TextDocument): Promise<void> {
	// In this simple example we get the settings for every validate run.
	let settings = await getDocumentSettings(textDocument.uri);

	let diagnostics: Diagnostic[] = [];

	let request: scls.DocumentUpdateRequest = {
		uri: textDocument.uri,
		content: textDocument.getText()
	};
	let response: scls.ServerResponse = await scls.sendDocumentUpdateRequest(request);

	switch (response.type) {
		case scls.ResponseType.DocumentOk: {
			let body: scls.DocumentOkResponseBody = response.body;

			if (body.compilerMessages) {
				for (let i of body.compilerMessages) {
					diagnostics.push(scls.toVscodeDiagnostic(i));
				}
			}
			break;
		}
		case scls.ResponseType.DocumentError:
			break;
	}

	// Send the computed diagnostics to VS Code.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });

	connection.languages.semanticTokens.refresh();
}

async function onCompletion(_textDocumentPosition: TextDocumentPositionParams): Promise<CompletionItem[]> {
	let request: scls.CompletionRequest = {
		uri: _textDocumentPosition.textDocument.uri,
		position: {
			line: _textDocumentPosition.position.line,
			column: _textDocumentPosition.position.character
		}
	};

	let response = await scls.sendCompletionRequest(request);

	switch (response.type) {
		case scls.ResponseType.Completion: {
			let body: scls.CompletionResponseBody = response.body;

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

							tags: i.deprecated ? [CompletionItemTag.Deprecated] : [],
							commitCharacters: ['.']
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

async function onSemanticTokens(params: SemanticTokensParams): Promise<SemanticTokens> {
	let request: scls.SemanticTokensRequest = {
		uri: params.textDocument.uri
	};

	let response = await scls.sendSemanticTokensRequest(request);

	switch (response.type) {
		case scls.ResponseType.SemanticTokens: {
			let body: scls.SemanticTokensResponseBody = response.body;

			let tokens: SemanticTokens = {
				data: []
			};

			if (body.semanticTokens) {
				let lastPosition: scls.SourcePosition | undefined = undefined;

				for (let i of body.semanticTokens) {
					if (i.type !== scls.SemanticTokenType.None) {
						if (lastPosition !== undefined) {
							if (i.position.line > lastPosition.line) {
								tokens.data.push(i.position.line - lastPosition.line);
								tokens.data.push(i.position.column);
							} else {
								tokens.data.push(0);
								tokens.data.push(i.position.column - lastPosition.column);
							}
						} else {
							tokens.data.push(i.position.line);
							tokens.data.push(i.position.column);
						}

						tokens.data.push(i.length);
						tokens.data.push(scls.toVscodeSemanticTokenIndex(i.type) as uinteger);

						let modifiers: uinteger = 0;
						if (i.modifiers) {
							for (let j of i.modifiers) {
								let m = scls.toVscodeSemanticTokenModifierIndex(j);
								if (m === undefined) {
									throw Error("Invalid semantic token modifier detected");
								}
								modifiers |= m;
							}
						}
						tokens.data.push(modifiers);

						lastPosition = i.position;
					}
				}
			}

			return tokens;
		}
	}

	throw Error("Invalid response from the server");
}

async function onHover(params: HoverParams): Promise<Hover> {
	let request: scls.HoverRequest = {
		uri: params.textDocument.uri,
		position: {
			line: params.position.line,
			column: params.position.character
		}
	};

	let response = await scls.sendHoverRequest(request);

	switch (response.type) {
		case scls.ResponseType.Hover: {
			let body: scls.HoverResponseBody = response.body;
			let value = "";

			switch (body.responseKind) {
				case scls.HoverResponseKind.None:
					break;
				case scls.HoverResponseKind.Declaration: {
					let contents: scls.DeclarationHoverResponseContents = body.contents;

					if (contents.documentation !== undefined) {
						value += contents.documentation;
						value += "\n\n";
						value += "<hr/>";
						value += "\n\n";
					}

					switch (contents.declarationKind) {
						case scls.DeclarationKind.Property: {
							let metadata = contents.metadata as scls.PropertyDeclarationMetadata;

							value += "(Property) ";

							value += "```slake\n";

							value += "let "
							value += metadata.fullName;
							value += ": ";
							value += metadata.type;

							value += "\n```";

							break;
						}
						case scls.DeclarationKind.Var: {
							let metadata = contents.metadata as scls.VarDeclarationMetadata;

							value += "```slake\n";

							value += "let "
							value += metadata.fullName;
							value += ": ";
							value += metadata.type;

							value += "\n```";

							break;
						}
						case scls.DeclarationKind.Param: {
							let metadata = contents.metadata as scls.ParamDeclarationMetadata;

							value += "(Parameter) ";

							value += "```slake\n";

							value += "let "
							value += metadata.name;
							value += ": ";
							value += metadata.type;

							value += "\n```";

							break;
						}
						case scls.DeclarationKind.LocalVar: {
							let metadata = contents.metadata as scls.LocalVarDeclarationMetadata;

							value += "(Local Variable) ";

							value += "```slake\n";

							value += "let "
							value += metadata.name;
							value += ": ";
							value += metadata.type;

							value += "\n```";

							break;
						}
						case scls.DeclarationKind.FnOverloading: {
							let metadata = contents.metadata as scls.FnOverloadingDeclarationMetadata;

							value += "```slake\n";

							value += "fn "
							value += metadata.fullName;

							value += "(";

							if (metadata.paramDecls !== undefined) {
								for (let i = 0; i < metadata.paramDecls?.length; ++i) {
									let curParamDecl = metadata.paramDecls[i];

									value += curParamDecl.name;
									value += ": ";
									value += curParamDecl.type;
								}
							}

							value += ")";

							value += ": ";
							value += metadata.returnType;

							value += "\n```";

							break;
						}
						case scls.DeclarationKind.GenericParam: {
							let metadata = contents.metadata as scls.GenericParamDeclarationMetadata;

							value += "(Generic Parameter) ";

							value += "```slake\n";

							value += metadata.name;

							value += "\n```";

							break;
						}
						case scls.DeclarationKind.Class: {
							let metadata = contents.metadata as scls.ClassDeclarationMetadata;

							value += "```slake\n";

							value += "class ";
							value += metadata.fullName;

							value += "\n```";

							break;
						}
						case scls.DeclarationKind.Interface: {
							let metadata = contents.metadata as scls.ClassDeclarationMetadata;

							value += "```slake\n";

							value += "class ";
							value += metadata.fullName;

							value += "\n```";

							break;
						}
					}

					break;
				}
				default:
					throw Error("Invalid response kind");
			}

			return {
				contents: {
					kind: "markdown",
					value: value
				}
			};
		}
	}

	throw Error("Invalid response from the server");
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
