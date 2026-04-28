#!/usr/bin/env node
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const port = 3000;
const repoRoot = process.cwd();
const webDir = path.join(repoRoot, 'apps/web');
const nextCacheDir = path.join(webDir, '.next');
const checkOnly = process.argv.includes('--check');

function run(command) {
  return execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function findListenerPid(targetPort) {
  try {
    const output = run(`lsof -nP -iTCP:${targetPort} -sTCP:LISTEN -t`);
    return output.split('\n').map((value) => value.trim()).find(Boolean) || null;
  } catch {
    return null;
  }
}

function getCommand(pid) {
  try {
    return run(`ps -p ${pid} -o command=`);
  } catch {
    return '';
  }
}

function isManagedNextProcess(command) {
  return command.includes('next-server') || command.includes('next dev');
}

const existingPid = findListenerPid(port);
if (existingPid) {
  const command = getCommand(existingPid);
  if (!isManagedNextProcess(command)) {
    console.error(`Port ${port} is occupied by an unmanaged process: ${command || existingPid}`);
    process.exit(1);
  }

  if (checkOnly) {
    console.log(`would-stop:${existingPid}:${command}`);
    process.exit(0);
  }

  process.kill(Number(existingPid), 'SIGTERM');
}

if (checkOnly) {
  console.log('ready:web');
  process.exit(0);
}

fs.rmSync(nextCacheDir, { recursive: true, force: true });

const child = spawn('pnpm', ['--dir', webDir, 'dev'], {
  stdio: 'inherit',
  env: { ...process.env },
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
