import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

test('report builder is project-agnostic and accepts external visual findings', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'manta-generic-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await mkdir(join(dir, 'slides'), { recursive: true })
  await writeFile(join(dir, 'slides', 'custom.py'),
    'class Custom:\n    def construct(self):\n' + '        m.RoundedRectangle()\n'.repeat(10))
  const visual = join(dir, 'visual.json')
  await writeFile(visual, JSON.stringify([{
    id: 'custom-slide', kind: 'slide', image: 'build/slides/custom.png',
    review: { issues: ['自定义问题'], suggestions: ['自定义建议'], rules: ['R1-排版可读性'] },
  }]))
  const result = spawnSync(process.env.MANTA_PYTHON || 'python3', [
    'scripts/build_report.py', '--project-dir', dir, visual,
  ], { cwd: join(import.meta.dirname, '..'), encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(await readFile(join(dir, 'review', 'report.json'), 'utf8'))
  assert.equal(report.project, join(dir).split('/').pop())
  const custom = report.items.find((i) => i.id === 'custom-slide')
  assert.equal(custom.autoReview.issues[0], '自定义问题')
  const source = report.items.find((i) => i.id === 'source-custom')
  assert.ok(source.autoReview.rules.includes('R3-复杂度预算'))
  assert.ok(!JSON.stringify(report).includes('convergence_deck'))
})
