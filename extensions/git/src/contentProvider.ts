/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { workspace, Uri, Disposable, Event, EventEmitter } from 'vscode';
import { filterEvent } from './util';
import { Model } from './model';

export class GitContentProvider {

	private disposables: Disposable[] = [];

	private onDidChangeEmitter = new EventEmitter<Uri>();
	get onDidChange(): Event<Uri> { return this.onDidChangeEmitter.event; }

	private uris = new Set<Uri>();

	constructor(private model: Model, onWorkspaceChange: Event<Uri>) {
		const onGitChange = filterEvent(onWorkspaceChange, uri => /^\.git\//.test(workspace.asRelativePath(uri)));
		const onRelevantGitChange = filterEvent(onGitChange, uri => !/\/\.git\/index\.lock$/.test(uri.fsPath));

		this.disposables.push(
			onRelevantGitChange(this.fireChangeEvents, this),
			workspace.registerTextDocumentContentProvider('git', this)
		);
	}

	private fireChangeEvents(arg): void {
		for (let uri of this.uris) {
			this.onDidChangeEmitter.fire(uri);
		}
	}

	async provideTextDocumentContent(uri: Uri): Promise<string> {
		try {
			const result = await this.model.show(uri.query, uri);
			this.uris.add(uri);
			return result;
		} catch (err) {
			this.uris.delete(uri);
			return '';
		}
	}

	dispose(): void {
		this.disposables.forEach(d => d.dispose());
	}
}