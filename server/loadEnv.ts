import fs from 'node:fs';
import path from 'node:path';

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseEnvLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return null;

  const normalized = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed;
  const separator = normalized.indexOf('=');
  if (separator <= 0) return null;

  const key = normalized.slice(0, separator).trim();
  if (!key) return null;

  let rawValue = normalized.slice(separator + 1).trim();
  if (!rawValue) return { key, value: '' };

  // Remove trailing inline comments only for unquoted values.
  if (!rawValue.startsWith('"') && !rawValue.startsWith("'")) {
    const commentIndex = rawValue.indexOf(' #');
    if (commentIndex >= 0) {
      rawValue = rawValue.slice(0, commentIndex).trim();
    }
  }

  return {
    key,
    value: stripWrappingQuotes(rawValue)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r'),
  };
}

function parseEnvFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf8');
  const values: Record<string, string> = {};

  content.split(/\r?\n/).forEach((line) => {
    const parsed = parseEnvLine(line);
    if (!parsed) return;
    values[parsed.key] = parsed.value;
  });

  return values;
}

function loadLocalEnvFiles() {
  const root = process.cwd();
  const files = [
    '.env',
    '.env.local',
    '.env.server',
    '.env.server.local',
  ];

  const merged: Record<string, string> = {};
  files.forEach((name) => {
    const filePath = path.resolve(root, name);
    if (!fs.existsSync(filePath)) return;
    Object.assign(merged, parseEnvFile(filePath));
  });

  Object.entries(merged).forEach(([key, value]) => {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  });
}

loadLocalEnvFiles();
