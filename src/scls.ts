/**
 * Definitions about SCLS (Slake Core Language Server) Protocol.
 */
import * as http from 'http';
import { Diagnostic, Location } from 'vscode-languageserver/node';
import { Position } from 'vscode-languageserver-textdocument';
import { CompletionItemKind, DiagnosticSeverity, SemanticTokenModifiers, SemanticTokenTypes, uinteger } from 'vscode-languageserver/node';

//
// Basic types and enumerations.
//

export interface SourcePosition {
	line: uinteger;
	column: uinteger;
}

export interface SourceLocation {
	begin: SourcePosition;
	end: SourcePosition;
}

export function toVscodePosition(pos: SourcePosition): Position {
	return {
		line: pos.line,
		character: pos.column
	};
}

export function toVscodeLocation(loc: SourceLocation): Location {
	return {
		uri: "",
		range: {
			start: toVscodePosition(loc.begin),
			end: toVscodePosition(loc.end)
		}
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

export enum CompilerMessageType {
	Info = 0,
	Note,
	Warn,
	Error
}

export function toVscodeDiagnosticSeverity(type: CompilerMessageType): DiagnosticSeverity | undefined {
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
	location: SourceLocation;
	type: CompilerMessageType;
	message: string;
}

export function toVscodeDiagnostic(message: CompilerMessage): Diagnostic {
	return {
		range: toVscodeLocation(message.location).range,
		message: message.message,
		severity: toVscodeDiagnosticSeverity(message.type)
	};
}

export enum SemanticTokenType {
	None = 0,
	Type,
	Class,
	Enum,
	Interface,
	Struct,
	TypeParam,
	Param,
	Var,
	Property,
	EnumMember,
	Fn,
	Method,
	Keyword,
	Modifier,
	Comment,
	String,
	Number,
	Operator
}

// For SemanticTokenLegend.
export const vscodeSemanticTokenTypes: (SemanticTokenTypes | undefined)[] = [
	undefined,
	SemanticTokenTypes.type,
	SemanticTokenTypes.class,
	SemanticTokenTypes.enum,
	SemanticTokenTypes.interface,
	SemanticTokenTypes.struct,
	SemanticTokenTypes.typeParameter,
	SemanticTokenTypes.parameter,
	SemanticTokenTypes.variable,
	SemanticTokenTypes.property,
	SemanticTokenTypes.enumMember,
	SemanticTokenTypes.function,
	SemanticTokenTypes.method,
	SemanticTokenTypes.keyword,
	SemanticTokenTypes.modifier,
	SemanticTokenTypes.comment,
	SemanticTokenTypes.string,
	SemanticTokenTypes.number,
	SemanticTokenTypes.operator
];

export function toVscodeSemanticTokenType(type: SemanticTokenType): SemanticTokenTypes | undefined {
	return vscodeSemanticTokenTypes[type as number];
}

export function toVscodeSemanticTokenIndex(type: SemanticTokenType): uinteger | undefined {
	return (type as uinteger);
}

export enum SemanticTokenModifier {
	Decl = 0,
	Def,
	Readonly,
	Static,
	Deprecated,
	Abstract,
	Async
}

// For SemanticTokenLegend.
export const vscodeSemanticTokenModifiers: SemanticTokenModifiers[] = [
	SemanticTokenModifiers.declaration,
	SemanticTokenModifiers.definition,
	SemanticTokenModifiers.readonly,
	SemanticTokenModifiers.static,
	SemanticTokenModifiers.deprecated,
	SemanticTokenModifiers.abstract,
	SemanticTokenModifiers.async
];

export function toVscodeSemanticTokenModifier(modifier: SemanticTokenModifier): SemanticTokenModifiers | undefined {
	return vscodeSemanticTokenModifiers[modifier as uinteger];
}

export function toVscodeSemanticTokenModifierIndex(modifier: SemanticTokenModifier): uinteger | undefined {
	return (1 << (modifier as uinteger));
}

export interface SemanticToken {
	type: SemanticTokenType;
	modifiers: SemanticTokenModifier[];
	position: SourcePosition;
	length: uinteger;
}

//
// Request types.
//

export interface DocumentOpenRequest {
	uri: string;
	content: string;
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
	position: SourcePosition;
}

export interface SemanticTokensRequest {
	uri: string;
}

export interface HoverRequest {
	uri: string;
	position: SourcePosition;
}

//
// Response types.
//

export enum ResponseType {
	DocumentOk = 0,
	DocumentError,
	Completion,
	SemanticTokens,
	Hover
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

export interface SemanticTokensResponseBody {
	uri: string;
	semanticTokens: SemanticToken[];
}

export const enum DeclarationKind {
	Property = 0,
	Var,
	Param,
	LocalVar,
	FnOverloading,
	GenericParam,
	Class,
	Interface,
	Module
}

export type TypeName = string;

export interface VarDeclarationMetadata {
	fullName: string;
	type: TypeName;
}

export type PropertyDeclarationMetadata = VarDeclarationMetadata;

export interface ParamDeclarationMetadata {
	name: string;
	type: TypeName;
}

export interface LocalVarDeclarationMetadata {
	name: string;
	type: TypeName;
}

export interface FnOverloadingDeclarationMetadata {
	fullName: string;
	returnType: TypeName;
	paramDecls?: ParamDeclarationMetadata[];
	hasVaridicParams?: boolean;
}

export interface GenericParamDeclarationMetadata {
	name: string;
}

export interface ClassDeclarationMetadata {
	fullName: string;
}

export interface InterfaceDeclarationMetadata {
	fullName: string;
}

export type DeclarationMetadata =
	PropertyDeclarationMetadata |
	VarDeclarationMetadata |
	ParamDeclarationMetadata |
	LocalVarDeclarationMetadata |
	FnOverloadingDeclarationMetadata |
	GenericParamDeclarationMetadata |
	ClassDeclarationMetadata |
	InterfaceDeclarationMetadata;

export interface DeclarationHoverResponseContents {
	declarationKind: DeclarationKind;
	metadata: DeclarationMetadata;
	documentation?: string;
}

export enum HoverResponseKind {
	None = 0,
	Declaration
}

export interface HoverResponseBody {
	uri: string;
	responseKind: HoverResponseKind;
	contents: DeclarationHoverResponseContents;
}

export interface ServerResponse {
	type: ResponseType;
	body: any;
}

//
// SCLS server interaction definitions.
//

export let serverPort = 8080;

function sendRequest(data: string, path: string, method: string): Promise<string> {
	return new Promise((resolve, reject) => {
		let options: http.RequestOptions = {
			hostname: '127.0.0.1',
			port: serverPort,
			path: path,
			method: method
		};

		let buffer: string = "";

		let httpRequest = http.request(options, (res) => {
			res.setEncoding('utf8');
			res.on('data', (chunk) => {
				if (res.statusCode === 200) {
					buffer += chunk;
				} else {
					throw Error("Error from server with status code " + res.statusCode + ": " + chunk);
				}
			});
			res.on('end', () => {
				resolve(buffer);
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

export async function sendSemanticTokensRequest(request: SemanticTokensRequest): Promise<ServerResponse> {
	return JSON.parse(await sendRequest(JSON.stringify(request), "/semanticTokens", "post"));
}

export async function sendHoverRequest(request: HoverRequest): Promise<ServerResponse> {
	return JSON.parse(await sendRequest(JSON.stringify(request), "/hover", "post"));
}
