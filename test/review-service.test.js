import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ReviewService } from '../review-service.js'

async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'manta-review-'))
  await mkdir(join(dir, 'review'), { recursive: true })
  await writeFile(join(dir, 'review', 'report.json'), JSON.stringify({
    project: 'test', items: [{ id: 'slide-1', kind: 'slide', image: 'build/slides/a.png' }],
  }))
  return { dir, svc: new ReviewService(dir) }
}

test('annotations persist, merge into report, and survive feedback export', async (t) => {
  const { dir, svc } = await fixture()
  t.after(() => rm(dir, { recursive: true, force: true }))
  const rect = { x: 0.1, y: 0.2, width: 0.3, height: 0.25 }
  const saved = await svc.writeAnnotations('slide-1', [{ rect, comment: '箭头未对齐', rule: 'R3-拓扑与连线' }])
  assert.equal(saved.length, 1)
  assert.ok(saved[0].id)
  assert.deepEqual(saved[0].rect, rect)
  const report = await svc.readReport()
  assert.equal(report.items[0].annotations[0].comment, '箭头未对齐')
  assert.equal(report.items[0].image, '/manta-review/media/build/slides/a.png?project=default')
  const feedback = await svc.writeFeedback([{ id: 'slide-1', verdict: 'fail' }])
  assert.equal(feedback.entries[0].annotations.length, 1)
  assert.equal(feedback.fixList[0].annotations[0].rect.x, 0.1)
  const disk = JSON.parse(await readFile(join(dir, 'review', 'annotations.json'), 'utf8'))
  assert.equal(disk.version, 1)
  assert.equal(disk.items['slide-1'].length, 1)
  const empty = await svc.writeAnnotations('slide-1', [])
  assert.deepEqual(empty, [])
  assert.deepEqual((await svc.readReport()).items[0].annotations, [])
})

test('annotation validation rejects bad geometry and payload types', async (t) => {
  const { dir, svc } = await fixture()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await assert.rejects(() => svc.writeAnnotations('slide-1', [{ rect: { x: -0.1, y: 0, width: 0.2, height: 0.2 } }]), /0–1/)
  await assert.rejects(() => svc.writeAnnotations('slide-1', [{ rect: { x: 0.9, y: 0, width: 0.2, height: 0.2 } }]), /越出图片/)
  await assert.rejects(() => svc.writeAnnotations('slide-1', [{ rect: { x: 0, y: 0, width: 0.001, height: 0.2 } }]), /尺寸过小/)
  await assert.rejects(() => svc.writeAnnotations('slide-1', [{ rect: { x: 0, y: 0, width: 0.2, height: 0.2 }, comment: 42 }]), /评语类型/)
  await assert.rejects(() => svc.writeAnnotations('', []), /素材 id/)
})

test('acceptance requires every item to pass and is restored with the report', async (t) => {
  const { dir, svc } = await fixture()
  t.after(() => rm(dir, { recursive: true, force: true }))
  await assert.rejects(() => svc.writeAcceptance([]), /未标记通过/)
  const accepted = await svc.writeAcceptance([{ id: 'slide-1', verdict: 'pass', comment: '验收通过' }])
  assert.equal(accepted.status, 'accepted')
  assert.equal(accepted.entries[0].comment, '验收通过')
  const report = await svc.readReport()
  assert.equal(report.acceptance.id, accepted.id)
  assert.equal(report.acceptance.entries[0].verdict, 'pass')
  const disk = JSON.parse(await readFile(join(dir, 'review', 'acceptance.json'), 'utf8'))
  assert.equal(disk.status, 'accepted')
})

test('media paths stay inside allowed project prefixes', () => {
  const svc = new ReviewService('/tmp/project')
  assert.equal(svc.resolveMedia('build/slides/a.png'), '/tmp/project/build/slides/a.png')
  assert.equal(svc.resolveMedia('../secret'), undefined)
  assert.equal(svc.resolveMedia('/etc/passwd'), undefined)
})
