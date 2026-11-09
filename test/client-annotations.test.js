import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

function loadClient() {
  let factory
  let source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  source = source.replace("return {\n      inject: ['slots', 'locale'],", "return {\n      Card, makeRect, pointFromEvent,\n      inject: ['slots', 'locale'],")
  const React = {
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useState: (initial) => [initial, () => {}],
    useEffect: () => {}, useMemo: (fn) => fn(), useCallback: (fn) => fn,
    useRef: (current) => ({ current }),
  }
  vm.runInNewContext(source, {
    window: { __ModuleLoader__: { load: ({ factory: f }) => { factory = f } } },
  })
  return factory((name) => {
    if (name === 'react') return React
    throw new Error(`unexpected require: ${name}`)
  })
}

function walk(node, visit) {
  if (!node || typeof node !== 'object') return
  visit(node)
  for (const child of (node.children ?? []).flat(Infinity)) walk(child, visit)
}

function renderCard(item) {
  const { Card } = loadClient()
  return Card({
    item, t: (x) => x, verdict: null, comment: '', annotations: item.annotations ?? [],
    onVerdict() {}, onComment() {}, onAnnotationsChange: async () => {},
  })
}

test('reverse drags produce normalized rectangles', () => {
  const { makeRect } = loadClient()
  const rect = makeRect({ x: 0.8, y: 0.7 }, { x: 0.2, y: 0.2 })
  assert.equal(rect.x, 0.2)
  assert.equal(rect.y, 0.2)
  assert.ok(Math.abs(rect.width - 0.6) < 1e-12)
  assert.ok(Math.abs(rect.height - 0.5) < 1e-12)
})

test('pointer coordinates scale with the element and clamp at edges', () => {
  const { pointFromEvent } = loadClient()
  const element = { getBoundingClientRect: () => ({ left: 100, top: 50, width: 200, height: 100 }) }
  const center = pointFromEvent({ clientX: 200, clientY: 100 }, element)
  assert.equal(center.x, 0.5)
  assert.equal(center.y, 0.5)
  const edge = pointFromEvent({ clientX: 500, clientY: 500 }, element)
  assert.equal(edge.x, 1)
  assert.equal(edge.y, 1)
  assert.equal(pointFromEvent({ clientX: 0, clientY: 0 }, { getBoundingClientRect: () => ({ width: 0, height: 0 }) }), null)
})

test('cards render positioned annotation boxes and linked editors', () => {
  const annotation = { id: 'a1', rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.25 }, comment: 'fix', rule: 'R3-拓扑与连线' }
  const tree = renderCard({ id: 'slide-1', kind: 'slide', image: '/img.png', autoReview: {}, annotations: [annotation] })
  let box
  let editors = 0
  walk(tree, (n) => {
    if (n.props['data-annotation-id'] === 'a1') box = n
    if (n.props['data-annotation-editor'] === 'a1') editors++
  })
  assert.ok(box)
  assert.equal(box.props.style.left, '10%')
  assert.equal(box.props.style.top, '20%')
  assert.equal(box.props.style.width, '30%')
  assert.equal(box.props.style.height, '25%')
  assert.equal(box.props.style.border, '2px solid #FF3B30')
  assert.equal(editors, 1)
})

test('items without images do not render broken image elements', () => {
  const tree = renderCard({ id: 'global-size', kind: 'slide', image: null, autoReview: {}, annotations: [] })
  let images = 0
  walk(tree, (n) => { if (n.type === 'img') images++ })
  assert.equal(images, 0)
})
