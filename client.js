// Manta 审核面板 Client 侧：sidebar.panellist 图标 + main 面板。
// 支持 ✅/❌、图上拖框与意见、持久化 annotations.json、导出 feedback.json。
window.__ModuleLoader__.load({
  id: 'dsh-manta-workflow',
  factory(require) {
    const React = require('react')
    const { useState, useEffect, useMemo, useCallback, useRef } = React
    const h = React.createElement

    const DICTS = {
      zh: {
        'panel.title': 'Manta 视觉审核', 'panel.reload': '刷新', 'panel.export': '导出修改清单',
        'panel.project': '项目',
        'panel.exported': '已导出 feedback.json',
        'panel.complete': '完成验收', 'panel.accepted': '已验收',
        'panel.completed': '验收完成，已写入 acceptance.json',
        'panel.completeHint': '全部素材标记通过后可完成验收',
        'panel.empty': '暂无审核报告。请先运行 manta-production 流水线生成 review/report.json。',
        'panel.error': '加载失败',
        'filter.all': '全部', 'filter.slide': '幻灯片', 'filter.frame': '视频帧', 'filter.todo': '待标记',
        'card.pass': '通过', 'card.fail': '需修改', 'card.comment': '补充整页意见…',
        'card.issues': '自动意见', 'card.suggestions': '改进建议', 'card.source': '源码', 'card.sec': '秒',
        'card.annotate': '添加标注', 'card.annotating': '在图片上拖出方框', 'card.done': '完成',
        'card.annotations': '图上意见', 'card.annotationComment': '填写这个方框的评审意见…',
        'card.noRule': '未分类', 'card.save': '保存意见', 'card.delete': '删除',
        'card.deleteConfirm': '确定删除这条图上意见？', 'card.saveFailed': '标注保存失败',
        'stat.passed': '已通过', 'stat.failed': '需修改', 'stat.pending': '待标记',
      },
      en: {
        'panel.title': 'Manta Visual Review', 'panel.reload': 'Reload', 'panel.export': 'Export fix list',
        'panel.project': 'Project',
        'panel.exported': 'feedback.json exported',
        'panel.complete': 'Complete acceptance', 'panel.accepted': 'Accepted',
        'panel.completed': 'Acceptance saved to acceptance.json',
        'panel.completeHint': 'Mark every item as passed before completing acceptance',
        'panel.empty': 'No review report yet. Run the manta-production pipeline to generate review/report.json.',
        'panel.error': 'Load failed',
        'filter.all': 'All', 'filter.slide': 'Slides', 'filter.frame': 'Video frames', 'filter.todo': 'Unmarked',
        'card.pass': 'Pass', 'card.fail': 'Needs fix', 'card.comment': 'Add a page-level comment…',
        'card.issues': 'Auto findings', 'card.suggestions': 'Suggestions', 'card.source': 'Source', 'card.sec': 's',
        'card.annotate': 'Annotate', 'card.annotating': 'Drag a box on the image', 'card.done': 'Done',
        'card.annotations': 'Image annotations', 'card.annotationComment': 'Comment on this box…',
        'card.noRule': 'Uncategorized', 'card.save': 'Save comment', 'card.delete': 'Delete',
        'card.deleteConfirm': 'Delete this image annotation?', 'card.saveFailed': 'Could not save annotation',
        'stat.passed': 'Passed', 'stat.failed': 'Needs fix', 'stat.pending': 'Unmarked',
      },
    }

    const RULE_OPTIONS = [
      'R1-排版可读性', 'R2-科学图表严谨性', 'R3-拓扑与连线',
      'R4-时序与动画', 'R5-视频技术质量', 'R6-主题一致性',
    ]

    const clamp01 = (n) => Math.max(0, Math.min(1, n))

    function pointFromEvent(event, element) {
      const bounds = element.getBoundingClientRect()
      if (bounds.width <= 0 || bounds.height <= 0) return null
      return {
        x: clamp01((event.clientX - bounds.left) / bounds.width),
        y: clamp01((event.clientY - bounds.top) / bounds.height),
      }
    }

    function makeRect(a, b) {
      const x = Math.min(a.x, b.x)
      const y = Math.min(a.y, b.y)
      return { x, y, width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) }
    }

    const newAnnotationId = () => globalThis.crypto?.randomUUID?.() ??
      `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    function PanelIcon({ size = 20 }) {
      return h('svg', {
        width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
        'aria-hidden': true, 'data-dsh-plugin': 'dsh-manta-workflow',
      },
      h('rect', { x: 2.5, y: 4, width: 19, height: 13, rx: 2, stroke: 'currentColor', strokeWidth: 1.7 }),
      h('path', { d: 'M5 14 L9 10 L12 12.5 L15.5 8.5 L19 11.5', stroke: 'currentColor', strokeWidth: 1.7, strokeLinejoin: 'round', fill: 'none' }),
      h('path', { d: 'M9 21 L12 17 L15 21', stroke: 'currentColor', strokeWidth: 1.7, fill: 'none', strokeLinejoin: 'round' }))
    }

    function ReviewPanel({ t }) {
      const [report, setReport] = useState(null)
      const [error, setError] = useState(null)
      const [verdicts, setVerdicts] = useState({})
      const [comments, setComments] = useState({})
      const [annotations, setAnnotations] = useState({}) // itemId -> annotation[]
      const [acceptance, setAcceptance] = useState(null)
      const [projects, setProjects] = useState([])
      const [currentProject, setCurrentProject] = useState(null)
      const [filter, setFilter] = useState('all')
      const [notice, setNotice] = useState(null)

      const loadProjects = useCallback(async () => {
        setError(null)
        try {
          const res = await fetch('/manta-review/api/projects', { cache: 'no-store' })
          const body = await res.json()
          if (!res.ok) throw new Error(body.error ?? res.status)
          setProjects(body.items)
          let saved = null
          try { saved = globalThis.localStorage?.getItem('manta-review.project') } catch { /* 无持久化权限时使用默认项目 */ }
          const valid = body.items.some((p) => p.id === saved)
          setCurrentProject(valid ? saved : body.defaultProject)
        } catch (e) {
          setError(String(e.message ?? e))
        }
      }, [])

      const projectQuery = currentProject ? `?project=${encodeURIComponent(currentProject)}` : ''
      const load = useCallback(async () => {
        if (!currentProject) return
        setError(null)
        try {
          const res = await fetch(`/manta-review/api/report${projectQuery}`, { cache: 'no-store' })
          const body = await res.json()
          if (!res.ok) throw new Error(body.error ?? res.status)
          setReport(body)
          setAnnotations(Object.fromEntries(body.items.map((it) => [it.id, it.annotations ?? []])))
          const accepted = body.acceptance?.reportGeneratedAt === body.generatedAt ? body.acceptance : null
          setAcceptance(accepted)
          if (accepted) {
            setVerdicts(Object.fromEntries(accepted.entries.map((e) => [e.id, 'pass'])))
            setComments(Object.fromEntries(accepted.entries.map((e) => [e.id, e.comment ?? ''])))
          }
        } catch (e) {
          setError(String(e.message ?? e))
        }
      }, [currentProject])

      useEffect(() => { loadProjects() }, [loadProjects])
      useEffect(() => { load() }, [load])

      const items = report?.items ?? []
      const filtered = useMemo(() => items.filter((it) => {
        if (filter === 'slide') return it.kind === 'slide'
        if (filter === 'frame') return it.kind === 'frame'
        if (filter === 'todo') return !verdicts[it.id]
        return true
      }), [items, filter, verdicts])

      const stats = useMemo(() => {
        let passed = 0, failed = 0
        for (const it of items) {
          if (verdicts[it.id] === 'pass') passed++
          else if (verdicts[it.id] === 'fail') failed++
        }
        return { passed, failed, pending: items.length - passed - failed }
      }, [items, verdicts])

      const setVerdict = (id, v) => {
        setAcceptance(null)
        setVerdicts((s) => ({ ...s, [id]: s[id] === v ? undefined : v }))
      }

      const selectProject = (next) => {
        if (!next || next === currentProject) return
        try { globalThis.localStorage?.setItem('manta-review.project', next) } catch { /* 忽略偏好写入失败 */ }
        setCurrentProject(next)
        setReport(null)
        setError(null)
        setVerdicts({})
        setComments({})
        setAnnotations({})
        setAcceptance(null)
        setNotice(null)
      }

      const saveAnnotations = useCallback(async (itemId, next) => {
        const res = await fetch(`/manta-review/api/annotations${projectQuery}`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ itemId, annotations: next }),
        })
        const body = await res.json()
        if (!res.ok) throw new Error(body.error ?? res.status)
        setAnnotations((s) => ({ ...s, [itemId]: body.annotations }))
        setAcceptance(null)
        if (body.annotations.length > 0) {
          setVerdicts((s) => ({ ...s, [itemId]: 'fail' }))
        }
        return body.annotations
      }, [currentProject])

      const completeAcceptance = async () => {
        setNotice(null)
        const entries = items.map((it) => ({
          id: it.id, verdict: 'pass', comment: comments[it.id] || undefined,
        }))
        try {
          const res = await fetch(`/manta-review/api/acceptance${projectQuery}`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ entries }),
          })
          const body = await res.json()
          if (!res.ok) throw new Error(body.error ?? res.status)
          setAcceptance(body)
          setNotice(t('panel.completed'))
        } catch (e) {
          setNotice(String(e.message ?? e))
        }
      }

      const exportFeedback = async () => {
        setNotice(null)
        const entries = items
          .filter((it) => verdicts[it.id] || (annotations[it.id]?.length ?? 0) > 0)
          .map((it) => ({
            id: it.id,
            verdict: verdicts[it.id] ?? 'fail',
            comment: comments[it.id] || undefined,
          }))
        try {
          const res = await fetch(`/manta-review/api/feedback${projectQuery}`, {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ entries }),
          })
          const body = await res.json()
          if (!res.ok) throw new Error(body.error ?? res.status)
          setNotice(`${t('panel.exported')}（${entries.length}）`)
        } catch (e) {
          setNotice(String(e.message ?? e))
        }
      }

      if (error) {
        return h('div', { style: panelStyle },
          h('div', { style: emptyStyle }, `${t('panel.error')}: ${error}`),
          h('button', { style: btnStyle, onClick: currentProject ? load : loadProjects }, t('panel.reload')))
      }
      if (!report) return h('div', { style: panelStyle }, h('div', { style: emptyStyle }, '…'))
      if (items.length === 0) {
        return h('div', { style: panelStyle }, h('div', { style: emptyStyle }, t('panel.empty')))
      }
      const allPassed = items.every((it) => verdicts[it.id] === 'pass')

      return h('div', { style: panelStyle },
        h('div', { style: headStyle },
          h('label', { style: metaStyle }, `${t('panel.project')}: `,
            h('select', {
              value: currentProject ?? '', disabled: projects.length === 0,
              onChange: (e) => selectProject(e.target.value), style: projectSelectStyle,
            }, projects.map((p) => h('option', { key: p.id, value: p.id }, p.id)))),
          h('span', { style: statChip('pass') }, `${t('stat.passed')} ${stats.passed}`),
          h('span', { style: statChip('fail') }, `${t('stat.failed')} ${stats.failed}`),
          h('span', { style: chipBase }, `${t('stat.pending')} ${stats.pending}`),
          h('span', { style: { flex: 1 } }),
          h('button', { style: btnStyle, onClick: load }, t('panel.reload')),
          h('button', { style: primaryBtn, onClick: exportFeedback }, t('panel.export')),
          h('button', {
            style: { ...acceptBtn, opacity: allPassed && !acceptance ? 1 : 0.45 },
            disabled: !allPassed || !!acceptance,
            title: !allPassed ? t('panel.completeHint') : '',
            onClick: completeAcceptance,
          }, acceptance ? `✓ ${t('panel.accepted')}` : t('panel.complete'))),
        notice && h('div', { style: noticeStyle }, notice),
        h('div', { style: filterRow }, ['all', 'slide', 'frame', 'todo'].map((f) => h('button', {
          key: f, style: filter === f ? filterBtnOn : filterBtn, onClick: () => setFilter(f),
        }, t(`filter.${f}`)))),
        h('div', { style: grid }, filtered.map((it) => h(Card, {
          key: it.id, item: it, t,
          verdict: verdicts[it.id], comment: comments[it.id] ?? '',
          annotations: annotations[it.id] ?? [],
          onVerdict: (v) => setVerdict(it.id, v),
          onComment: (c) => {
            setAcceptance(null)
            setComments((s) => ({ ...s, [it.id]: c }))
          },
          onAnnotationsChange: saveAnnotations,
        }))))
    }

    function Card({ item: it, t, verdict, comment, annotations, onVerdict, onComment, onAnnotationsChange }) {
      const auto = it.autoReview ?? {}
      const [annotating, setAnnotating] = useState(false)
      const [draft, setDraft] = useState(null)
      const [selectedId, setSelectedId] = useState(null)
      const [edits, setEdits] = useState({}) // annotationId -> {comment?, rule?}
      const [busy, setBusy] = useState(false)
      const [saveError, setSaveError] = useState(null)
      const dragRef = useRef(null)

      const persist = async (next, { selectId, clearIds = [] } = {}) => {
        setBusy(true)
        setSaveError(null)
        try {
          await onAnnotationsChange(it.id, next)
          setEdits((s) => {
            const copy = { ...s }
            for (const id of clearIds) delete copy[id]
            return copy
          })
          if (selectId !== undefined) setSelectedId(selectId)
          return true
        } catch (e) {
          setSaveError(String(e.message ?? e))
          return false
        } finally {
          setBusy(false)
        }
      }

      const createAnnotation = async (rect) => {
        const annotation = { id: newAnnotationId(), rect, comment: '', rule: '' }
        if (await persist([...annotations, annotation], { selectId: annotation.id })) setAnnotating(false)
      }

      const onPointerDown = (e) => {
        if (!annotating || busy || e.button !== 0) return
        const point = pointFromEvent(e, e.currentTarget)
        if (!point) return
        dragRef.current = { pointerId: e.pointerId, start: point }
        setDraft({ x: point.x, y: point.y, width: 0, height: 0 })
        e.currentTarget.setPointerCapture(e.pointerId)
        e.preventDefault()
      }
      const onPointerMove = (e) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== e.pointerId) return
        const point = pointFromEvent(e, e.currentTarget)
        if (point) setDraft(makeRect(drag.start, point))
      }
      const finishDrag = (e, cancelled = false) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== e.pointerId) return
        const point = pointFromEvent(e, e.currentTarget)
        const rect = point ? makeRect(drag.start, point) : null
        dragRef.current = null
        setDraft(null)
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
        if (!cancelled && rect && rect.width >= 0.01 && rect.height >= 0.01) createAnnotation(rect)
      }

      const commit = async (a) => {
        const edit = edits[a.id]
        if (!edit) return
        const next = annotations.map((x) => x.id === a.id ? { ...x, ...edit } : x)
        await persist(next, { clearIds: [a.id] })
      }

      const updateAndSave = async (a, patch) => {
        const nextEdit = { ...(edits[a.id] ?? {}), ...patch }
        setEdits((s) => ({ ...s, [a.id]: nextEdit }))
        const next = annotations.map((x) => x.id === a.id ? { ...x, ...nextEdit } : x)
        await persist(next, { clearIds: [a.id] })
      }

      const removeAnnotation = async (a) => {
        if (!globalThis.confirm?.(t('card.deleteConfirm'))) return
        const next = annotations.filter((x) => x.id !== a.id)
        if (await persist(next, { selectId: null, clearIds: [a.id] })) setSelectedId(null)
      }

      return h('div', { style: cardStyle(verdict) },
        it.image && h('div', { style: { position: 'relative' } },
          h('img', {
            src: it.image, alt: it.id, loading: 'lazy', draggable: false,
            onDragStart: (e) => e.preventDefault(),
            style: { width: '100%', display: 'block', borderRadius: 6, background: '#0002', userSelect: 'none' },
          }),
          h('span', { style: tagStyle() },
            it.kind === 'frame' && it.timestamp != null ? `t=${it.timestamp}${t('card.sec')}` : it.kind),
          h('div', {
            style: { position: 'absolute', inset: 0, cursor: annotating ? 'crosshair' : 'default', touchAction: annotating ? 'none' : 'auto' },
            onPointerDown, onPointerMove,
            onPointerUp: (e) => finishDrag(e), onPointerCancel: (e) => finishDrag(e, true),
          },
          annotations.map((a, i) => h('button', {
            key: a.id, type: 'button', 'data-annotation-id': a.id,
            'aria-label': `${t('card.annotations')} #${i + 1}`,
            style: annotationBoxStyle(a.rect, selectedId === a.id),
            onPointerDown: (e) => e.stopPropagation(),
            onClick: (e) => { e.stopPropagation(); setSelectedId(a.id) },
          }, h('span', { style: annotationNumberStyle }, i + 1))),
          draft && h('div', { 'data-draft': true, style: annotationBoxStyle(draft, true) }))),

        h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 2px' } },
          h('div', { style: { fontWeight: 600, fontSize: 13, flex: 1 } }, it.id),
          it.image && h('button', {
            type: 'button', disabled: busy,
            style: annotating ? filterBtnOn : btnBase,
            onClick: () => { setAnnotating((v) => !v); setDraft(null); dragRef.current = null },
          }, annotating ? t('card.done') : t('card.annotate'))),
        annotating && h('div', { style: hintStyle }, t('card.annotating')),
        saveError && h('div', { style: errorTextStyle }, `${t('card.saveFailed')}: ${saveError}`),

        annotations.length > 0 && h('div', { style: annotationListStyle },
          h('div', { style: metaStyle }, `${t('card.annotations')}（${annotations.length}）`),
          annotations.map((a, i) => {
            const edit = edits[a.id] ?? {}
            const currentComment = edit.comment ?? a.comment
            const currentRule = edit.rule ?? a.rule
            const selected = selectedId === a.id
            const options = RULE_OPTIONS.includes(currentRule) || !currentRule ? RULE_OPTIONS : [currentRule, ...RULE_OPTIONS]
            return h('div', {
              key: a.id, 'data-annotation-editor': a.id,
              style: annotationEditorStyle(selected), onClick: () => setSelectedId(a.id),
            },
            h('div', { style: annotationEditorHead },
              h('button', { type: 'button', style: annotationLinkStyle, onClick: () => setSelectedId(a.id) }, `#${i + 1}`),
              h('select', {
                value: currentRule, disabled: busy, style: ruleSelectStyle,
                onChange: (e) => updateAndSave(a, { rule: e.target.value }),
              }, h('option', { value: '' }, t('card.noRule')), options.map((r) => h('option', { key: r, value: r }, r))),
              h('button', { type: 'button', disabled: busy || !edit, style: smallBtnStyle, onClick: () => commit(a) }, t('card.save')),
              h('button', { type: 'button', disabled: busy, style: smallDangerBtn, onClick: () => removeAnnotation(a) }, t('card.delete'))),
            h('textarea', {
              value: currentComment, placeholder: t('card.annotationComment'), disabled: busy,
              onChange: (e) => setEdits((s) => ({ ...s, [a.id]: { ...(s[a.id] ?? {}), comment: e.target.value } })),
              onBlur: () => commit(a), style: annotationCommentStyle,
            }))
          })),

        it.source && h('div', { style: metaStyle },
          `${t('card.source')}: ${it.source.file}${it.source.line != null ? ':' + it.source.line : ''}`),
        (auto.rules?.length ?? 0) > 0 && h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 } },
          auto.rules.map((r, i) => h('span', { key: i, style: ruleTag }, r))),
        auto.issues?.length > 0 && h('ul', { style: listStyle }, auto.issues.map((s, i) => h('li', { key: i }, s))),
        auto.suggestions?.length > 0 && h('div', { style: { ...metaStyle, marginTop: 2 } },
          `${t('card.suggestions')}: `, ...auto.suggestions.flatMap((s, i) => [i > 0 && '；', h('span', { key: i }, s)])),
        h('textarea', {
          value: comment, placeholder: t('card.comment'), onChange: (e) => onComment(e.target.value), style: commentStyle,
        }),
        h('div', { style: { display: 'flex', gap: 6 } },
          h('button', { style: verdict === 'pass' ? btnPassOn : btnBase, onClick: () => onVerdict('pass') }, `✅ ${t('card.pass')}`),
          h('button', { style: verdict === 'fail' ? btnFailOn : btnBase, onClick: () => onVerdict('fail') }, `❌ ${t('card.fail')}`)))
    }

    // ── 样式（沿用宿主主题 token） ─────────────────────────────────────
    const panelStyle = { height: '100%', overflowY: 'auto', padding: 16, color: 'var(--dsw-alias-label-primary)', background: 'var(--dsw-alias-bg-base)', fontFamily: 'inherit' }
    const emptyStyle = { color: 'var(--dsw-alias-label-secondary)', padding: '32px 8px', textAlign: 'center' }
    const headStyle = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }
    const chipBase = { fontSize: 12, padding: '2px 10px', borderRadius: 999, border: '1px solid var(--dsw-alias-border-l2)', color: 'var(--dsw-alias-label-secondary)' }
    const statChip = (kind) => ({ ...chipBase,
      ...(kind === 'pass' ? { color: 'var(--dsw-alias-state-success-primary)', borderColor: 'var(--dsw-alias-state-success-primary)' } : {}),
      ...(kind === 'fail' ? { color: 'var(--dsw-alias-state-error-primary)', borderColor: 'var(--dsw-alias-state-error-primary)' } : {}) })
    const btnBase = { font: 'inherit', fontSize: 12, cursor: 'pointer', borderRadius: 6, padding: '4px 10px', border: '1px solid var(--dsw-alias-border-l2)', background: 'transparent', color: 'var(--dsw-alias-label-primary)' }
    const btnStyle = btnBase
    const primaryBtn = { ...btnBase, color: 'var(--dsw-alias-label-primary-foreground)', background: 'var(--dsw-alias-button-primary-fill)', borderColor: 'transparent' }
    const acceptBtn = { ...primaryBtn, background: 'var(--dsw-alias-state-success-primary)' }
    const btnPassOn = { ...btnBase, color: 'var(--dsw-alias-state-success-primary)', borderColor: 'var(--dsw-alias-state-success-primary)', background: 'color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent)' }
    const btnFailOn = { ...btnBase, color: 'var(--dsw-alias-state-error-primary)', borderColor: 'var(--dsw-alias-state-error-primary)', background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent)' }
    const noticeStyle = { fontSize: 12, color: 'var(--dsw-alias-state-success-primary)', marginBottom: 8 }
    const filterRow = { display: 'flex', gap: 6, marginBottom: 12 }
    const filterBtn = { ...btnBase, borderRadius: 999, padding: '2px 12px' }
    const filterBtnOn = { ...filterBtn, background: 'var(--dsw-alias-interactive-bg-active)', borderColor: 'var(--dsw-alias-brand-primary)' }
    const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }
    const cardStyle = (verdict) => ({ border: '1px solid var(--dsw-alias-border-l2)', borderRadius: 10, padding: 10, background: 'var(--dsw-alias-bg-layer-2)',
      ...(verdict === 'pass' ? { borderColor: 'var(--dsw-alias-state-success-primary)' } : {}),
      ...(verdict === 'fail' ? { borderColor: 'var(--dsw-alias-state-error-primary)' } : {}) })
    const metaStyle = { fontSize: 11.5, color: 'var(--dsw-alias-label-secondary)' }
    const listStyle = { margin: '4px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--dsw-alias-label-primary)' }
    const ruleTag = { fontSize: 10.5, padding: '1px 6px', borderRadius: 4, border: '1px solid var(--dsw-alias-border-l2)', color: 'var(--dsw-alias-label-secondary)' }
    const tagStyle = () => ({ position: 'absolute', top: 6, left: 6, fontSize: 10.5, padding: '1px 7px', borderRadius: 4, background: 'var(--dsw-alias-bg-mask-1, #0009)', color: 'var(--dsw-alias-label-primary-foreground, #fff)', pointerEvents: 'none' })
    const commentStyle = { width: '100%', boxSizing: 'border-box', font: 'inherit', fontSize: 12, marginTop: 8, padding: '5px 8px', borderRadius: 6, resize: 'vertical', minHeight: 34, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)' }
    const hintStyle = { ...metaStyle, marginBottom: 6, color: 'var(--dsw-alias-brand-primary)' }
    const errorTextStyle = { fontSize: 11.5, color: 'var(--dsw-alias-state-error-primary)', margin: '4px 0' }
    const annotationBoxStyle = (rect, selected) => ({
      position: 'absolute', left: `${rect.x * 100}%`, top: `${rect.y * 100}%`,
      width: `${rect.width * 100}%`, height: `${rect.height * 100}%`,
      boxSizing: 'border-box', margin: 0, padding: 0, borderRadius: 2,
      border: '2px solid #FF3B30',
      background: selected ? 'rgba(255, 59, 48, 0.16)' : 'rgba(255, 59, 48, 0.08)',
      boxShadow: selected ? '0 0 0 2px rgba(255, 59, 48, 0.45), 0 0 12px rgba(255, 59, 48, 0.65)' : '0 0 0 1px rgba(255, 59, 48, 0.2)',
      cursor: 'pointer', zIndex: selected ? 3 : 2,
    })
    const annotationNumberStyle = { position: 'absolute', top: 0, left: 0, minWidth: 16, padding: '1px 4px', fontSize: 10, lineHeight: '14px', textAlign: 'center', color: 'var(--dsw-alias-label-primary-foreground, #fff)', background: '#FF3B30', pointerEvents: 'none' }
    const annotationListStyle = { display: 'flex', flexDirection: 'column', gap: 6, margin: '6px 0' }
    const annotationEditorStyle = (selected) => ({ border: `1px solid ${selected ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l2)'}`, borderRadius: 6, padding: 6, background: selected ? 'color-mix(in srgb, var(--dsw-alias-brand-primary) 6%, transparent)' : 'transparent' })
    const annotationEditorHead = { display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }
    const annotationLinkStyle = { ...btnBase, border: 0, padding: '1px 3px', color: 'var(--dsw-alias-brand-primary)', fontWeight: 600 }
    const ruleSelectStyle = { flex: 1, minWidth: 0, font: 'inherit', fontSize: 11, padding: '2px 4px', borderRadius: 4, border: '1px solid var(--dsw-alias-border-l2)', background: 'var(--dsw-alias-bg-layer-1)', color: 'var(--dsw-alias-label-primary)' }
    const projectSelectStyle = { ...ruleSelectStyle, marginLeft: 4, padding: '4px 8px', fontSize: 12 }
    const smallBtnStyle = { ...btnBase, padding: '2px 6px', fontSize: 10.5 }
    const smallDangerBtn = { ...smallBtnStyle, color: 'var(--dsw-alias-state-error-primary)' }
    const annotationCommentStyle = { ...commentStyle, marginTop: 0, minHeight: 42, fontSize: 11.5 }

    return {
      inject: ['slots', 'locale'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register('dsh-manta-workflow', DICTS), 'manta-workflow: dicts')
        const t = (key) => {
          try { return ctx.locale.translate('dsh-manta-workflow', key) ?? key }
          catch { return DICTS.zh[key] ?? key }
        }
        const PANEL_ID = 'manta-review'
        ctx.effect(() => ctx.slots.inject('main', () => ctx.slots.register(
          { name: 'main', key: PANEL_ID, locale: 'dsh-manta-workflow' }, () => h(ReviewPanel, { t }))), 'manta-workflow: main panel')
        ctx.effect(() => ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
          { name: 'sidebar.panellist', id: PANEL_ID, order: 40, label: () => t('panel.title'), locale: 'dsh-manta-workflow' }, PanelIcon)), 'manta-workflow: sidebar icon')
      },
    }
  },
})
