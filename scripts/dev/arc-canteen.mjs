#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const INSTALL_COMMAND = 'uv tool install git+https://github.com/the-canteen-dev/ARC-cli.git'
const ARC_CANTEEN_COMMAND = 'arc-canteen'

function printHelp() {
  console.log(`Causeway ARC CLI helper

Runtime payment verification does not depend on ARC CLI. This helper is for development,
hackathon context sync, and retrieving Canteen Arc RPC configuration.

Usage:
  npm run arc:check
  npm run arc:rpc
  npm run arc:context
  npm run arc:status
  npm run arc:cli -- <arc-canteen args>

Install ARC CLI when missing:
  ${INSTALL_COMMAND}
`)
}

function runArcCanteen(args, options = {}) {
  let missingResult = null
  for (const command of arcCanteenCandidates()) {
    if (command !== ARC_CANTEEN_COMMAND && !existsSync(command)) continue
    const result = spawnSync(command, args, {
      stdio: options.stdio ?? 'inherit',
      shell: false,
      windowsHide: true,
    })
    if (!isMissingExecutable(result)) return result
    missingResult = result
  }
  return missingResult ?? spawnSync(ARC_CANTEEN_COMMAND, args, {
    stdio: options.stdio ?? 'inherit',
    shell: false,
    windowsHide: true,
  })
}

function isMissingExecutable(result) {
  return result.error?.code === 'ENOENT'
}

function arcCanteenCandidates() {
  const localBin = join(homedir(), '.local', 'bin')
  const localNames = process.platform === 'win32'
    ? ['arc-canteen.exe', 'arc-canteen.cmd', 'arc-canteen']
    : ['arc-canteen']
  return [
    process.env.ARC_CANTEEN_BIN,
    ARC_CANTEEN_COMMAND,
    ...localNames.map((name) => join(localBin, name)),
  ].filter(Boolean)
}

function checkArcCanteen() {
  const result = runArcCanteen(['--help'], { stdio: 'ignore' })
  if (isMissingExecutable(result)) {
    console.log('arc-canteen is not installed.')
    console.log(`Install it with: ${INSTALL_COMMAND}`)
    return 0
  }
  if (result.error) {
    console.error(`arc-canteen check failed: ${result.error.message}`)
    return 1
  }
  console.log('arc-canteen is installed and available to Causeway project scripts.')
  return 0
}

const args = process.argv.slice(2)
const command = args[0]

if (!command || command === 'help' || command === '--help' || command === '-h') {
  printHelp()
  process.exit(0)
}

if (command === 'check') {
  process.exit(checkArcCanteen())
}

const result = runArcCanteen(args)
if (isMissingExecutable(result)) {
  console.error('arc-canteen is not installed or not available on PATH.')
  console.error(`Install it with: ${INSTALL_COMMAND}`)
  process.exit(1)
}
if (result.error) {
  console.error(`arc-canteen failed: ${result.error.message}`)
  process.exit(1)
}
process.exit(result.status ?? 0)
