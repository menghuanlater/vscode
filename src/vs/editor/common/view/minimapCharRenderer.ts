/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { CharCode } from 'vs/base/common/charCode';
import { ColorId, TokenizationRegistry } from 'vs/editor/common/modes';
import Event, { Emitter } from 'vs/base/common/event';
import { Color } from 'vs/base/common/color';

export class ParsedColor {

	public readonly r: number;
	public readonly g: number;
	public readonly b: number;
	public readonly isLight: boolean;

	constructor(r, g, b) {
		this.r = r;
		this.g = g;
		this.b = b;
		this.isLight = ((r + g + b) / (3 * 255) > 0.5);
	}

	public toCSSHex(): string {
		return `#${ParsedColor._toTwoDigitHex(this.r)}${ParsedColor._toTwoDigitHex(this.g)}${ParsedColor._toTwoDigitHex(this.b)}`;
	}

	private static _toTwoDigitHex(n: number): string {
		let r = n.toString(16);
		if (r.length !== 2) {
			return '0' + r;
		}
		return r;
	}
}

export class MinimapTokensColorTracker {
	private static _INSTANCE: MinimapTokensColorTracker = null;
	public static getInstance(): MinimapTokensColorTracker {
		if (!this._INSTANCE) {
			this._INSTANCE = new MinimapTokensColorTracker();
		}
		return this._INSTANCE;
	}

	private _colors: ParsedColor[];

	private _onDidChange = new Emitter<void>();
	public onDidChange: Event<void> = this._onDidChange.event;

	private constructor() {
		this._setColorMap(TokenizationRegistry.getColorMap());
		TokenizationRegistry.onDidChange((e) => {
			if (e.changedColorMap) {
				this._setColorMap(TokenizationRegistry.getColorMap());
			}
		});
	}

	private _setColorMap(colorMap: Color[]): void {
		this._colors = [null];
		for (let colorId = 1; colorId < colorMap.length; colorId++) {
			const color = colorMap[colorId].toRGBA();
			this._colors[colorId] = new ParsedColor(color.r, color.g, color.b);
		}
		this._onDidChange.fire(void 0);
	}

	public getColor(colorId: ColorId): ParsedColor {
		if (colorId < 1 || colorId >= this._colors.length) {
			// background color (basically invisible)
			colorId = 2;
		}
		return this._colors[colorId];
	}

	public static _parseColor(color: string): ParsedColor {
		if (!color) {
			return new ParsedColor(0, 0, 0);
		}
		if (color.charCodeAt(0) === CharCode.Hash) {
			color = color.substr(1, 6);
		} else {
			color = color.substr(0, 6);
		}
		if (color.length !== 6) {
			return new ParsedColor(0, 0, 0);
		}

		let r = 16 * this._parseHexDigit(color.charCodeAt(0)) + this._parseHexDigit(color.charCodeAt(1));
		let g = 16 * this._parseHexDigit(color.charCodeAt(2)) + this._parseHexDigit(color.charCodeAt(3));
		let b = 16 * this._parseHexDigit(color.charCodeAt(4)) + this._parseHexDigit(color.charCodeAt(5));
		return new ParsedColor(r, g, b);
	}

	private static _parseHexDigit(charCode: CharCode): number {
		switch (charCode) {
			case CharCode.Digit0: return 0;
			case CharCode.Digit1: return 1;
			case CharCode.Digit2: return 2;
			case CharCode.Digit3: return 3;
			case CharCode.Digit4: return 4;
			case CharCode.Digit5: return 5;
			case CharCode.Digit6: return 6;
			case CharCode.Digit7: return 7;
			case CharCode.Digit8: return 8;
			case CharCode.Digit9: return 9;
			case CharCode.a: return 10;
			case CharCode.A: return 10;
			case CharCode.b: return 11;
			case CharCode.B: return 11;
			case CharCode.c: return 12;
			case CharCode.C: return 12;
			case CharCode.d: return 13;
			case CharCode.D: return 13;
			case CharCode.e: return 14;
			case CharCode.E: return 14;
			case CharCode.f: return 15;
			case CharCode.F: return 15;
		}
		return 0;
	}
}

export const enum Constants {
	START_CH_CODE = 32, // Space
	END_CH_CODE = 126, // Tilde (~)
	CHAR_COUNT = END_CH_CODE - START_CH_CODE + 1,

	SAMPLED_CHAR_HEIGHT = 16,
	SAMPLED_CHAR_WIDTH = 10,
	SAMPLED_HALF_CHAR_WIDTH = SAMPLED_CHAR_WIDTH / 2,

	x2_CHAR_HEIGHT = 4,
	x2_CHAR_WIDTH = 2,

	x1_CHAR_HEIGHT = 2,
	x1_CHAR_WIDTH = 1,

	RGBA_CHANNELS_CNT = 4,
}

export class MinimapCharRenderer {

	_minimapCharRendererBrand: void;

	public readonly x2charData: Uint8ClampedArray;
	public readonly x1charData: Uint8ClampedArray;

	public readonly x2charDataLight: Uint8ClampedArray;
	public readonly x1charDataLight: Uint8ClampedArray;

	constructor(x2CharData: Uint8ClampedArray, x1CharData: Uint8ClampedArray) {
		const x2ExpectedLen = Constants.x2_CHAR_HEIGHT * Constants.x2_CHAR_WIDTH * Constants.CHAR_COUNT;
		if (x2CharData.length !== x2ExpectedLen) {
			throw new Error('Invalid x2CharData');
		}
		const x1ExpectedLen = Constants.x1_CHAR_HEIGHT * Constants.x1_CHAR_WIDTH * Constants.CHAR_COUNT;
		if (x1CharData.length !== x1ExpectedLen) {
			throw new Error('Invalid x1CharData');
		}
		this.x2charData = x2CharData;
		this.x1charData = x1CharData;

		this.x2charDataLight = MinimapCharRenderer.soften(x2CharData, 12 / 15);
		this.x1charDataLight = MinimapCharRenderer.soften(x1CharData, 50 / 60);
	}

	private static soften(input: Uint8ClampedArray, ratio: number): Uint8ClampedArray {
		let result = new Uint8ClampedArray(input.length);
		for (let i = 0, len = input.length; i < len; i++) {
			result[i] = input[i] * ratio;
		}
		return result;
	}

	private static _getChIndex(chCode: number): number {
		chCode -= Constants.START_CH_CODE;
		if (chCode < 0) {
			chCode += Constants.CHAR_COUNT;
		}
		return (chCode % Constants.CHAR_COUNT);
	}

	public x2RenderChar(target: ImageData, dx: number, dy: number, chCode: number, color: ParsedColor, backgroundColor: ParsedColor): void {
		if (dx + Constants.x2_CHAR_WIDTH > target.width || dy + Constants.x2_CHAR_HEIGHT > target.height) {
			console.warn('bad render request outside image data');
			return;
		}
		const x2CharData = backgroundColor.isLight ? this.x2charDataLight : this.x2charData;
		const chIndex = MinimapCharRenderer._getChIndex(chCode);

		const outWidth = target.width * Constants.RGBA_CHANNELS_CNT;

		const backgroundR = backgroundColor.r;
		const backgroundG = backgroundColor.g;
		const backgroundB = backgroundColor.b;

		const deltaR = color.r - backgroundR;
		const deltaG = color.g - backgroundG;
		const deltaB = color.b - backgroundB;

		const dest = target.data;
		const sourceOffset = chIndex * Constants.x2_CHAR_HEIGHT * Constants.x2_CHAR_WIDTH;
		let destOffset = dy * outWidth + dx * Constants.RGBA_CHANNELS_CNT;
		{
			const c = x2CharData[sourceOffset] / 255;
			dest[destOffset + 0] = backgroundR + deltaR * c;
			dest[destOffset + 1] = backgroundG + deltaG * c;
			dest[destOffset + 2] = backgroundB + deltaB * c;
		}
		{
			const c = x2CharData[sourceOffset + 1] / 255;
			dest[destOffset + 4] = backgroundR + deltaR * c;
			dest[destOffset + 5] = backgroundG + deltaG * c;
			dest[destOffset + 6] = backgroundB + deltaB * c;
		}

		destOffset += outWidth;
		{
			const c = x2CharData[sourceOffset + 2] / 255;
			dest[destOffset + 0] = backgroundR + deltaR * c;
			dest[destOffset + 1] = backgroundG + deltaG * c;
			dest[destOffset + 2] = backgroundB + deltaB * c;
		}
		{
			const c = x2CharData[sourceOffset + 3] / 255;
			dest[destOffset + 4] = backgroundR + deltaR * c;
			dest[destOffset + 5] = backgroundG + deltaG * c;
			dest[destOffset + 6] = backgroundB + deltaB * c;
		}

		destOffset += outWidth;
		{
			const c = x2CharData[sourceOffset + 4] / 255;
			dest[destOffset + 0] = backgroundR + deltaR * c;
			dest[destOffset + 1] = backgroundG + deltaG * c;
			dest[destOffset + 2] = backgroundB + deltaB * c;
		}
		{
			const c = x2CharData[sourceOffset + 5] / 255;
			dest[destOffset + 4] = backgroundR + deltaR * c;
			dest[destOffset + 5] = backgroundG + deltaG * c;
			dest[destOffset + 6] = backgroundB + deltaB * c;
		}

		destOffset += outWidth;
		{
			const c = x2CharData[sourceOffset + 6] / 255;
			dest[destOffset + 0] = backgroundR + deltaR * c;
			dest[destOffset + 1] = backgroundG + deltaG * c;
			dest[destOffset + 2] = backgroundB + deltaB * c;
		}
		{
			const c = x2CharData[sourceOffset + 7] / 255;
			dest[destOffset + 4] = backgroundR + deltaR * c;
			dest[destOffset + 5] = backgroundG + deltaG * c;
			dest[destOffset + 6] = backgroundB + deltaB * c;
		}
	}

	public x1RenderChar(target: ImageData, dx: number, dy: number, chCode: number, color: ParsedColor, backgroundColor: ParsedColor): void {
		if (dx + Constants.x1_CHAR_WIDTH > target.width || dy + Constants.x1_CHAR_HEIGHT > target.height) {
			console.warn('bad render request outside image data');
			return;
		}
		const x1CharData = backgroundColor.isLight ? this.x1charDataLight : this.x1charData;
		const chIndex = MinimapCharRenderer._getChIndex(chCode);

		const outWidth = target.width * Constants.RGBA_CHANNELS_CNT;

		const backgroundR = backgroundColor.r;
		const backgroundG = backgroundColor.g;
		const backgroundB = backgroundColor.b;

		const deltaR = color.r - backgroundR;
		const deltaG = color.g - backgroundG;
		const deltaB = color.b - backgroundB;

		const dest = target.data;
		const sourceOffset = chIndex * Constants.x1_CHAR_HEIGHT * Constants.x1_CHAR_WIDTH;
		let destOffset = dy * outWidth + dx * Constants.RGBA_CHANNELS_CNT;
		{
			const c = x1CharData[sourceOffset] / 255;
			dest[destOffset + 0] = backgroundR + deltaR * c;
			dest[destOffset + 1] = backgroundG + deltaG * c;
			dest[destOffset + 2] = backgroundB + deltaB * c;
		}

		destOffset += outWidth;
		{
			const c = x1CharData[sourceOffset + 1] / 255;
			dest[destOffset + 0] = backgroundR + deltaR * c;
			dest[destOffset + 1] = backgroundG + deltaG * c;
			dest[destOffset + 2] = backgroundB + deltaB * c;
		}
	}
}
