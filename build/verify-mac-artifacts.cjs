const fs = require('node:fs')
const path = require('node:path')
const { execSync } = require('node:child_process')

const root = process.cwd()
const releaseRoot = path.join(root, 'release')
const argDir = process.argv[2]

function q(v) {
  return `"${String(v).replace(/"/g, '\\"')}"`
}

function run(title, cmd, hint) {
  process.stdout.write(`\n[verify] ${title}\n`)
  try {
    const out = execSync(cmd, { stdio: 'pipe', encoding: 'utf8', maxBuffer: 1024 * 1024 * 8 })
    if (out && out.trim()) process.stdout.write(`${out.trim()}\n`)
  } catch (error) {
    const stdout = String(error.stdout || '').trim()
    const stderr = String(error.stderr || '').trim()
    if (stdout) process.stderr.write(`${stdout}\n`)
    if (stderr) process.stderr.write(`${stderr}\n`)
    if (hint) process.stderr.write(`[verify] 建议: ${hint}\n`)
    throw new Error(`${title} 失败`)
  }
}

function listDirs(base) {
  if (!fs.existsSync(base)) return []
  return fs.readdirSync(base)
    .map(name => path.join(base, name))
    .filter(p => fs.existsSync(p) && fs.statSync(p).isDirectory())
}

function pickTargetDir() {
  if (argDir) {
    const abs = path.isAbsolute(argDir) ? argDir : path.join(root, argDir)
    if (!fs.existsSync(abs)) {
      throw new Error(`目录不存在: ${abs}`)
    }
    return abs
  }
  const dirs = listDirs(releaseRoot)
  if (dirs.length === 0) {
    throw new Error(`未找到 release 目录: ${releaseRoot}`)
  }
  dirs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
  return dirs[0]
}

function findApps(dir) {
  const result = []
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    const entries = fs.readdirSync(current, { withFileTypes: true })
    for (const entry of entries) {
      const full = path.join(current, entry.name)
      if (entry.isDirectory()) {
        if (entry.name.endsWith('.app')) {
          result.push(full)
          continue
        }
        stack.push(full)
      }
    }
  }
  return result
}

function findDmgs(dir) {
  return fs.readdirSync(dir)
    .filter(name => name.endsWith('.dmg'))
    .map(name => path.join(dir, name))
}

function verifyApp(appPath) {
  run(
    `codesign verify ${appPath}`,
    `codesign --verify --deep --strict --verbose=2 ${q(appPath)}`,
    '请确认使用 Developer ID 签名，且签名后未再修改 .app 内容'
  )
  run(
    `spctl assess ${appPath}`,
    `spctl -a -vvv ${q(appPath)}`,
    '请确认应用已完成 notarize 并通过 Gatekeeper 校验'
  )
  run(
    `stapler validate ${appPath}`,
    `xcrun stapler validate ${q(appPath)}`,
    '请确认 notarize 成功后已执行 stapler staple'
  )
}

function verifyDmg(dmgPath) {
  run(
    `spctl assess dmg ${dmgPath}`,
    `spctl -a -vvv -t open ${q(dmgPath)}`,
    '请确认 DMG 重新打包后未被二次修改'
  )
  run(
    `stapler validate dmg ${dmgPath}`,
    `xcrun stapler validate ${q(dmgPath)}`,
    '请确认 DMG 也已执行 stapler staple'
  )
}

function main() {
  if (process.platform !== 'darwin') {
    throw new Error('该脚本仅支持在 macOS 运行')
  }
  const targetDir = pickTargetDir()
  process.stdout.write(`[verify] 使用目录: ${targetDir}\n`)

  const apps = findApps(targetDir)
  const dmgs = findDmgs(targetDir)
  if (apps.length === 0 && dmgs.length === 0) {
    throw new Error(`目录中未找到 .app 或 .dmg: ${targetDir}`)
  }

  for (const appPath of apps) {
    verifyApp(appPath)
  }
  for (const dmgPath of dmgs) {
    verifyDmg(dmgPath)
  }

  process.stdout.write('\n[verify] 全部校验通过\n')
}

try {
  main()
} catch (error) {
  process.stderr.write(`\n[verify] 失败: ${error.message}\n`)
  process.exit(1)
}
