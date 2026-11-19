#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { flattenRequests } from './collection-kit.mjs';

/**
 * A tiny executor for the collections in this folder. It is NOT Postman: it understands only the one-line checks
 * that collection-kit writes (status, oneOf, Content-Type, property/type, array/object, collectionVariables.set).
 * It exists to prove that every request of a collection works against a running server.
 */

const PATH = '((?:\\.[A-Za-z0-9_]+|\\[\\d+\\])*)';
const RE = {
  status: /pm\.response\.to\.have\.status\((\d+)\)/,
  oneOf: /pm\.expect\(pm\.response\.code\)\.to\.be\.oneOf\(\[([\d,\s]+)\]\)/,
  contentType: /pm\.expect\(pm\.response\.headers\.get\("Content-Type"\)\)\.to\.include\("([^"]+)"\)/,
  property: new RegExp(`pm\\.expect\\(pm\\.response\\.json\\(\\)${PATH}\\)\\.to\\.have\\.property\\("([^"]+)"\\)(?:\\.that\\.is\\.a\\("(\\w+)"\\))?`),
  kind: new RegExp(`pm\\.expect\\(pm\\.response\\.json\\(\\)${PATH}\\)\\.to\\.be\\.an\\("(array|object)"\\)`),
  save: new RegExp(`pm\\.(?:collectionVariables|environment)\\.set\\("([^"]+)",\\s*pm\\.response\\.json\\(\\)${PATH}\\)`),
  stamp: /pm\.collectionVariables\.set\("([^"]+)",\s*"([^"]*)"\s*\+\s*Date\.now\(\)\s*\+\s*"([^"]*)"\)/,
};

/** Reads the expectations out of a request's test script lines. */
export function parseTests(exec = []) {
  const parsed = { status: null, contentTypes: [], properties: [], kinds: [], saves: [] };
  for (const line of exec) {
    let m;
    if ((m = line.match(RE.status))) parsed.status = [Number(m[1])];
    else if ((m = line.match(RE.oneOf))) parsed.status = m[1].split(',').map((n) => Number(n.trim()));
    else if ((m = line.match(RE.contentType))) parsed.contentTypes.push(m[1]);
    else if ((m = line.match(RE.property))) parsed.properties.push({ path: m[1], name: m[2], type: m[3] });
    else if ((m = line.match(RE.kind))) parsed.kinds.push({ path: m[1], kind: m[2] });
    else if ((m = line.match(RE.save))) parsed.saves.push({ variable: m[1], path: m[2] });
  }
  return parsed;
}

/** Variables set by a pre-request script (only the "prefix" + Date.now() + "suffix" form is supported). */
export function parsePrerequest(exec = []) {
  const sets = [];
  for (const line of exec) {
    const m = line.match(RE.stamp);
    if (m) sets.push({ variable: m[1], prefix: m[2], suffix: m[3] });
  }
  return sets;
}

/** Walks a path such as ".user" or "[0].id" through parsed JSON. Returns { found, value }. */
export function pick(json, path) {
  let value = json;
  for (const [, key, index] of path.matchAll(/\.([A-Za-z0-9_]+)|\[(\d+)\]/g)) {
    if (value === null || typeof value !== 'object') return { found: false };
    const k = key ?? Number(index);
    if (!(k in value)) return { found: false };
    value = value[k];
  }
  return { found: true, value };
}

const typeOf = (v) => (Array.isArray(v) ? 'array' : v === null ? 'null' : typeof v);

/** Replaces {{name}} with a variable or a dynamic value. Returns the text and the names that stayed unresolved. */
export function resolveVariables(text, vars, random = Math.random) {
  const missing = [];
  const out = String(text).replace(/\{\{\s*([$\w.-]+)\s*\}\}/g, (whole, name) => {
    if (name === '$timestamp') return String(Math.floor(Date.now() / 1000));
    if (name === '$randomInt') return String(Math.floor(random() * 1000));
    if (name === '$guid') return crypto.randomUUID();
    if (vars[name] !== undefined && vars[name] !== '') return String(vars[name]);
    missing.push(name);
    return whole;
  });
  return { text: out, missing };
}

/** Minimal cookie jar: name=value per host; Max-Age=0 deletes. */
export class CookieJar {
  constructor() {
    this.cookies = new Map();
  }
  header(host) {
    return [...(this.cookies.get(host) ?? [])].map(([k, v]) => `${k}=${v}`).join('; ');
  }
  store(host, setCookieLines) {
    const jar = this.cookies.get(host) ?? new Map();
    for (const line of setCookieLines) {
      const [pair] = line.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index).trim();
      if (/Max-Age=0/i.test(line)) jar.delete(name);
      else jar.set(name, pair.slice(index + 1).trim());
    }
    this.cookies.set(host, jar);
  }
}

export function parseArgs(argv) {
  const args = { file: null, env: null, vars: {}, folder: null, before: [], quiet: false, baseUrl: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--env') args.env = argv[++i];
    else if (a === '--folder') args.folder = argv[++i];
    else if (a === '--base-url') args.baseUrl = argv[++i];
    else if (a === '--quiet') args.quiet = true;
    else if (a === '--before') args.before.push(argv[++i]);
    else if (a === '--var') {
      const [key, ...rest] = String(argv[++i]).split('=');
      args.vars[key] = rest.join('=');
    } else if (!args.file) args.file = a;
    else throw new Error(`Unexpected argument: ${a}`);
  }
  return args;
}

/** Runs every request in order. Returns { results, passed, failed }. */
export async function runCollection({ collection, environment, vars = {}, folder, before = [], baseUrlOverride, fetchImpl = fetch, log = () => {}, random }) {
  const variables = {};
  for (const v of collection.variable ?? []) variables[v.key] = v.value;
  for (const v of environment?.values ?? []) if (v.enabled !== false && v.value !== '') variables[v.key] = v.value;
  Object.assign(variables, vars);
  if (baseUrlOverride) variables.baseUrl = baseUrlOverride;

  const jar = new CookieJar();
  const send = async (method, url, headers, body) => {
    const host = new URL(url).host;
    const cookie = jar.header(host);
    const response = await fetchImpl(url, { method, headers: { ...headers, ...(cookie ? { cookie } : {}) }, body, redirect: 'manual' });
    jar.store(host, response.headers.getSetCookie());
    return response;
  };

  for (const spec of before) {
    const [, method, path, json] = spec.match(/^(\w+)\s+(\S+)(?:\s+(.+))?$/) ?? [];
    if (!method) throw new Error(`Bad --before value: ${spec}`);
    const { text } = resolveVariables(`{{baseUrl}}${path}`, variables, random);
    const res = await send(method, text, json ? { 'Content-Type': 'application/json' } : {}, json);
    log(`before ${spec} -> ${res.status}`);
  }

  const results = [];
  const wanted = flattenRequests(collection.item).filter(({ folder: f }) => !folder || f.includes(folder));
  for (const { folder: where, item } of wanted) {
    const expectations = parseTests((item.event ?? []).find((e) => e.listen === 'test')?.script?.exec);
    for (const stamp of parsePrerequest((item.event ?? []).find((e) => e.listen === 'prerequest')?.script?.exec)) {
      variables[stamp.variable] = `${stamp.prefix}${Date.now()}${stamp.suffix}`;
    }
    const r = item.request;
    const urlPart = resolveVariables(r.url.raw, variables, random);
    const bodyPart = r.body ? resolveVariables(r.body.raw, variables, random) : { text: undefined, missing: [] };
    const headers = {};
    for (const h of r.header ?? []) if (!h.disabled) headers[h.key] = resolveVariables(h.value, variables, random).text;
    const result = { folder: where, name: item.name, method: r.method, url: urlPart.text, expected: expectations.status, status: null, ok: false, errors: [] };
    const missing = [...new Set([...urlPart.missing, ...bodyPart.missing])];
    if (missing.length) {
      result.errors.push(`unresolved variable(s): ${missing.join(', ')} (set them with --var name=value or in the environment)`);
    } else {
      try {
        const response = await send(r.method, urlPart.text, headers, bodyPart.text);
        result.status = response.status;
        const text = await response.text();
        let json;
        try { json = JSON.parse(text); } catch { json = undefined; }
        if (expectations.status && !expectations.status.includes(response.status)) result.errors.push(`status ${response.status}, expected ${expectations.status.join(' or ')}`);
        for (const type of expectations.contentTypes) {
          if (!(response.headers.get('content-type') ?? '').includes(type)) result.errors.push(`Content-Type is not ${type}`);
        }
        const statusOk = expectations.status?.includes(response.status);
        if (statusOk || !expectations.status) {
          for (const { path, kind } of expectations.kinds) {
            const got = json === undefined ? { found: false } : pick(json, path);
            if (!got.found || typeOf(got.value) !== kind) result.errors.push(`body${path} is not ${kind === 'array' ? 'an array' : 'an object'}`);
          }
          for (const { path, name, type } of expectations.properties) {
            const parent = json === undefined ? { found: false } : pick(json, path);
            const child = parent.found && parent.value && typeof parent.value === 'object' ? pick(parent.value, `.${name}`) : { found: false };
            if (!child.found) result.errors.push(`body${path} has no property ${name}`);
            else if (type && typeOf(child.value) !== type) result.errors.push(`body${path}.${name} is ${typeOf(child.value)}, expected ${type}`);
          }
          for (const { variable, path } of expectations.saves) {
            const got = json === undefined ? { found: false } : pick(json, path);
            if (got.found && got.value !== undefined && got.value !== null) variables[variable] = got.value;
            else result.errors.push(`could not save ${variable} from body${path}`);
          }
        }
      } catch (error) {
        result.errors.push(`request failed: ${error.message}`);
      }
    }
    result.ok = result.errors.length === 0;
    results.push(result);
    log(`${result.ok ? 'PASS' : 'FAIL'} ${String(result.status ?? '---')} ${result.method} ${result.url}  [${where}] ${result.name}${result.ok ? '' : `\n      ${result.errors.join('\n      ')}`}`);
  }
  const failed = results.filter((x) => !x.ok).length;
  return { results, passed: results.length - failed, failed, variables };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file) {
    console.error('Usage: node run-collection.mjs <collection.json> --base-url http://localhost:PORT [--env env.json] [--var name=value] [--folder text] [--before "POST /api/dev/reset"]');
    process.exit(2);
  }
  const collection = JSON.parse(readFileSync(args.file, 'utf8'));
  const environment = args.env ? JSON.parse(readFileSync(args.env, 'utf8')) : undefined;
  const { passed, failed } = await runCollection({ collection, environment, vars: args.vars, folder: args.folder, before: args.before, baseUrlOverride: args.baseUrl, log: args.quiet ? () => {} : console.log });
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
