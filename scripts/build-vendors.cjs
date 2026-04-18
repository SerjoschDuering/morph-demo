const esbuild = require('../node_modules/esbuild/lib/main.js');
const path = require('path');

const root = path.join(__dirname, '..');

esbuild.buildSync({
  stdin: {
    contents: `
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
window.React = React;
window.ReactDOM = ReactDOM;
`,
    loader: 'js',
    resolveDir: root,
  },
  bundle: true,
  format: 'iife',
  outfile: path.join(root, 'public/vendor/react-bundle.js'),
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
});

esbuild.buildSync({
  stdin: {
    contents: `
import { marked } from 'marked';
import DOMPurify from 'dompurify';
window.marked = marked;
window.DOMPurify = DOMPurify;
`,
    loader: 'js',
    resolveDir: root,
  },
  bundle: true,
  format: 'iife',
  outfile: path.join(root, 'public/vendor/utils-bundle.js'),
  minify: true,
  define: { 'process.env.NODE_ENV': '"production"' },
});

console.log('[vendors] built react-bundle.js + utils-bundle.js');
