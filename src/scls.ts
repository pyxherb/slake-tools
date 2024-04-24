/**
 * Definitions about SCLS (Slake Core Language Server) Protocol.
 */
import * as http from 'http';
import { Position } from 'vscode-languageserver-textdocument';
import { CompletionItemKind, DiagnosticSeverity } from 'vscode-languageserver/node';

export interface Location {
	line: number;
	column: number;
}

export function toVscodePosition(loc: Location): Position {
	return {
		line: loc.line,
		character: loc.column
	};
}

export enum ClientMarkupType {
	PlainText = 0,
	Markdown = 1
}

export enum CompletionItemType {
	Var = 0,
	LocalVar,
	Param,
	Fn,
	Type,
	GenericParam,
	Class,
	Interface,
	Trait,
	Module,
	Enum,
	EnumConst,
	File,
	Keyword
}

export function toVscodeCompletionItemType(completionItemType: CompletionItemType): CompletionItemKind | undefined {
	switch (completionItemType) {
		case CompletionItemType.Var:
			return CompletionItemKind.Variable;
		case CompletionItemType.LocalVar:
			return CompletionItemKind.Variable;
		case CompletionItemType.Param:
			return CompletionItemKind.Variable;
		case CompletionItemType.Fn:
			return CompletionItemKind.Function;
		case CompletionItemType.Type:
			return CompletionItemKind.Keyword;
		case CompletionItemType.GenericParam:
			return CompletionItemKind.TypeParameter;
		case CompletionItemType.Class:
			return CompletionItemKind.Class;
		case CompletionItemType.Interface:
			return CompletionItemKind.Interface;
		case CompletionItemType.Trait:
			return CompletionItemKind.Interface;
		case CompletionItemType.Module:
			return CompletionItemKind.Module;
		case CompletionItemType.Enum:
			return CompletionItemKind.Enum;
		case CompletionItemType.EnumConst:
			return CompletionItemKind.EnumMember;
		case CompletionItemType.File:
			return CompletionItemKind.File;
		case CompletionItemType.Keyword:
			return CompletionItemKind.Keyword;
		default:
			return undefined;
	}
}

export interface CompletionItem {
	type: CompletionItemType;

	label: string;
	details: string;
	documentations: string;
	insertText: string;

	deprecated: boolean;
}

export interface DocumentOpenRequest {
	uri: string;
	languageId: string;
	markupType: ClientMarkupType;
}

export interface DocumentUpdateRequest {
	uri: string;
	content: string;
}

export interface DocumentCloseRequest {
	uri: string;
}

export interface CompletionRequest {
	uri: string;
	location: Location;
}

export enum CompilerMessageType {
	Info = 0,
	Note,
	Warn,
	Error
}

export function toDiagnosticSeverity(type: CompilerMessageType): DiagnosticSeverity | undefined {
	switch (type) {
		case CompilerMessageType.Info:
			return DiagnosticSeverity.Information;
		case CompilerMessageType.Note:
			return DiagnosticSeverity.Hint;
		case CompilerMessageType.Warn:
			return DiagnosticSeverity.Warning;
		case CompilerMessageType.Error:
			return DiagnosticSeverity.Error;
		default:
			return undefined;
	}
}

export interface CompilerMessage {
	location: Location;
	type: CompilerMessageType;
	message: string;
}

export interface DocumentOkResponseBody {
	uri: string;
	compilerMessages: CompilerMessage[];
}

export interface DocumentErrorResponseBody {
	uri: string;
	code: number;
	message: string;
}

export interface CompletionResponseBody {
	uri: string;
	completionItems: CompletionItem[];
}

export enum ResponseType {
	DocumentOk = 0,
	DocumentError,
	Completion
}

export interface ServerResponse {
	type: ResponseType;
	body: any;
}

//
// SCLS server interaction definitions
//

let serverPort = 11451;

function sendRequest(data: string, path: string, method: string): Promise<string> {
	return new Promise((resolve, reject) => {
		let options: http.RequestOptions = {
			hostname: '127.0.0.1',
			port: serverPort,
			path: path,
			method: method
		};

		let httpRequest = http.request(options, (res) => {
			res.setEncoding('utf8');
			res.on('data', (chunk) => {
				if (res.statusCode === 200) {
					resolve(chunk);
				} else {
					throw Error("Error from server with status code " + res.statusCode + ": " + chunk);
				}
			});
		});
		httpRequest.on('error', (e) => {
			throw e;
		});
		httpRequest.setTimeout(30 * 1000);

		httpRequest.write(data);
		httpRequest.end();
	});
}

export async function sendDocumentOpenRequest(request: DocumentOpenRequest): Promise<ServerResponse> {
	return JSON.parse(await sendRequest(JSON.stringify(request), "/documentOpen", "post"));
}

export async function sendDocumentUpdateRequest(request: DocumentUpdateRequest): Promise<ServerResponse> {
	return JSON.parse(await sendRequest(JSON.stringify(request), "/documentUpdate", "put"));
}

export async function sendDocumentCloseRequest(request: DocumentCloseRequest): Promise<ServerResponse> {
	return JSON.parse(await sendRequest(JSON.stringify(request), "/documentClose", "post"));
}

export async function sendCompletionRequest(request: CompletionRequest): Promise<ServerResponse> {
	return JSON.parse(await sendRequest(JSON.stringify(request), "/completion", "post"));
}
