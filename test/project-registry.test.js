import test from 'node:test'
import assert from 'node:assert/strict'
import { ProjectRegistry } from '../project-registry.js'

test('multiple projects resolve to isolated services with a configured default', () => {
  const registry = new ProjectRegistry({
    projects: { alpha: '/tmp/alpha', beta: '/tmp/beta' }, defaultProject: 'beta',
  })
  assert.deepEqual(registry.list(), {
    items: [{ id: 'alpha' }, { id: 'beta' }], defaultProject: 'beta',
  })
  const alpha = registry.service('alpha')
  assert.equal(alpha.projectDir, '/tmp/alpha')
  assert.equal(alpha.projectId, 'alpha')
  assert.equal(registry.service('alpha'), alpha)
  assert.equal(registry.service().projectDir, '/tmp/beta')
  assert.equal(alpha.mediaUrl('build/a.png'), '/manta-review/media/build/a.png?project=alpha')
  assert.equal(alpha.resolveMedia('../beta/review/report.json'), undefined)
  assert.throws(() => registry.service('unknown'), /未知项目/)
})

test('legacy projectDir and zero-config cwd remain supported', () => {
  const legacy = new ProjectRegistry({ projectDir: '/tmp/legacy' })
  assert.equal(legacy.defaultProject, 'default')
  assert.equal(legacy.service().projectDir, '/tmp/legacy')
  const fallback = new ProjectRegistry({}, { cwd: '/tmp/fallback' })
  assert.equal(fallback.service().projectDir, '/tmp/fallback')
})
