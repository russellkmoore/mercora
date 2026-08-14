import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { TELEMETRY_EVENTS } from '@/lib/observability/telemetry';

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : [];
  });
}

const producerSources = [...sourceFiles('app'), ...sourceFiles('lib'), 'worker.ts'];

function parseSource(path: string): ts.SourceFile {
  const source = readFileSync(join(process.cwd(), path), 'utf8');
  return ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function telemetryCalls(source: ts.SourceFile): Set<string> {
  const events = new Set<string>();
  const collectEventLiterals = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node)) events.add(node.text);
    else ts.forEachChild(node, collectEventLiterals);
  };
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
      node.expression.text === 'recordTelemetry' &&
      node.arguments[0]) {
      collectEventLiterals(node.arguments[0]);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return events;
}

function rawExceptionConsoleCalls(source: ts.SourceFile): string[] {
  const calls: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'console' &&
      (node.expression.name.text === 'error' || node.expression.name.text === 'warn') &&
      node.arguments.some((argument) => ts.isIdentifier(argument) && argument.text === 'error')) {
      calls.push(node.expression.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return calls;
}

describe('actionable failure telemetry source contract', () => {
  const callsByPath = new Map(
    producerSources.map((path) => [path, telemetryCalls(parseSource(path))] as const),
  );

  it('wires every critical taxonomy event into executable producer code', () => {
    const wiredEvents = new Set([...callsByPath.values()].flatMap((events) => [...events]));
    const criticalEvents = Object.entries(TELEMETRY_EVENTS)
      .filter(([, definition]) => definition.severity === 'critical')
      .map(([event]) => event);

    expect(criticalEvents.filter((event) => !wiredEvents.has(event))).toEqual([]);
  });

  it('keeps every executable producer event in the closed taxonomy', () => {
    const taxonomy = new Set(Object.keys(TELEMETRY_EVENTS));
    for (const [path, calls] of callsByPath) {
      for (const event of calls) expect(taxonomy.has(event), `${path}: ${event}`).toBe(true);
    }
  });

  it('does not retain raw exception console logging in instrumented boundaries', () => {
    for (const [path, calls] of callsByPath) {
      if (calls.size === 0) continue;
      expect(rawExceptionConsoleCalls(parseSource(path)), path).toEqual([]);
    }
  });
});
