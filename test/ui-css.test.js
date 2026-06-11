import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

test('keeps watermark source branches at the same fixed height', () => {
  assert.equal(readRuleValue('.field-grid', 'height'), '70px');
  assert.equal(readRuleValue('.watermark-source', 'height'), '70px');
  assert.equal(readRuleValue('.field-grid', 'min-height'), null);
  assert.equal(readRuleValue('.watermark-source', 'min-height'), null);
});

test('uses a light interface base with orange as the accent', () => {
  assert.equal(readRootVariable('--bg'), '#fcfbfa');
  assert.equal(readRootVariable('--surface'), '#ffffff');
  assert.equal(readRootVariable('--accent'), '#e4762f');
});

test('styles range controls without dark empty tracks', () => {
  assert.equal(readRootVariable('--track'), '#e7dfd7');
  assert.equal(readRootVariable('--track-hover'), '#ddd2c8');
  assert.equal(readRuleValue('.range-control input::-webkit-slider-runnable-track', 'background'), 'var(--track)');
  assert.equal(readRuleValue('.range-control input:hover::-webkit-slider-runnable-track', 'background'), 'var(--track-hover)');
});

test('supports portrait preview without gradients', () => {
  assert.equal(readRuleValue('.video-frame', 'background'), '#eee6df');
  assert.equal(readRuleValue('.video-frame', 'container-type'), 'size');
  assert.equal(readRuleValue('.video-frame.portrait', 'aspect-ratio'), '9 / 16');
  assert.equal(readRuleValue('.video-frame.portrait', 'width'), 'min(46%, 236px)');
  assert.equal(css.includes('linear-gradient'), false);
});

test('lays out watermark blend options without nested cards', () => {
  assert.equal(readRuleValue('.blend-grid', 'display'), 'grid');
  assert.equal(readRuleValue('.blend-grid', 'grid-template-columns'), 'repeat(5, minmax(0, 1fr))');
  assert.equal(readRuleValue('.blend-grid button', 'border-radius'), '8px');
});

test('shows the app version beside the title without tiny caption styling', () => {
  assert.equal(readRuleValue('.title-heading', 'display'), 'flex');
  assert.equal(readRuleValue('.app-version', 'font-size'), '14px');
  assert.equal(readRuleValue('.app-version', 'color'), 'var(--accent-strong)');
});

function readRootVariable(name) {
  const match = new RegExp(`${escapeRegExp(name)}:\\s*([^;]+);`).exec(css);
  return match?.[1].trim() || null;
}

function readRuleValue(selector, property) {
  const rule = readRule(selector);
  const match = new RegExp(`${escapeRegExp(property)}:\\s*([^;]+);`).exec(rule);
  return match?.[1].trim() || null;
}

function readRule(selector) {
  const match = new RegExp(`${escapeRegExp(selector)}\\s*\\{([^}]+)\\}`).exec(css);
  return match?.[1] || '';
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
