#!/usr/bin/env node
/*
 * build-single-file.js — TAM Intelligence OS v2.6.0 (Phase 0)
 * -----------------------------------------------------------------
 * Reassembles the modular source (index.html + css/ + js/) into the
 * portable single-file release:
 *     dist/tam-intelligence-os-v2.6.0.html
 *
 * It inlines the five CSS files into one <style> and the twenty JS
 * files into one <script>, preserving order. No minification (Phase 0).
 * External XLSX + Google Fonts links are left untouched, so the portable
 * build behaves exactly like earlier single-file releases.
 *
 * Usage:  node tools/build-single-file.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const LF = '\n';

const cssFiles = ['tokens.css', 'base.css', 'shell.css', 'components.css', 'charts.css'];
// JS load order lives in one place (mirrored by index.html). Paths are relative to js/.
const jsFiles = require('./module-order.js');

const read = (p) => fs.readFileSync(p, 'utf8');

let html = read(path.join(root, 'index.html'));

const cssLinkBlock = cssFiles.map((f) => `<link rel="stylesheet" href="css/${f}">`).join(LF);
const jsTagBlock = jsFiles.map((f) => `<script src="js/${f}"></script>`).join(LF);
if (!html.includes(cssLinkBlock)) throw new Error('CSS <link> block not found in index.html — cannot inline.');
if (!html.includes(jsTagBlock)) throw new Error('JS <script src> block not found in index.html — cannot inline (is index.html in sync with module-order.js?).');

const cssInline = '<style>' + LF + cssFiles.map((f) => read(path.join(root, 'css', f))).join(LF) + LF + '</style>';
const jsInline = '<script>' + LF + jsFiles.map((f) => read(path.join(root, 'js', f))).join(LF) + LF + '</script>';

html = html.replace(cssLinkBlock, cssInline).replace(jsTagBlock, jsInline);

const outDir = path.join(root, 'dist');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'tam-intelligence-os-v2.6.3b.html');
fs.writeFileSync(outPath, html, 'utf8');

console.log('Built ' + path.relative(root, outPath) + ' (' + Buffer.byteLength(html, 'utf8') + ' bytes)');
