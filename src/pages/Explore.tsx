import { useEffect, useState } from 'react'
import { Icon } from '../components/Icon'
import { Empty, Media, Skeleton, TopBar, VitrineRow, useLoad } from '../components/ui'
import { api } from '../lib/api'
import { navigate } from '../lib/router'
import type { VitrineType } from '../lib/types'
import { formatPrice } from '../lib/utils'

const TABS: { id: VitrineType | ''; label: string }[] = [
  { id: '', label: 'Tout' }, { id: 'commerce', label: 'Boutiques' },
  { id: 'agriculture', label: 'Agricole' }, { id: 'service', label: 'Services' },
]

export default function Explore({ params }: { params: Record<string, string> }) {
  const type = (params.type ?? '') as VitrineType | ''
  const cat = params.cat ?? ''
  const [q, setQ] = useState(params.q ?? '')
  const [debounced, setDebounced] = useState(q)
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(t) }, [q])

  const setParam = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ type, cat, q, ...patch })
    ;[...p.keys()].forEach((k) => { if (!p.get(k)) p.delete(k) })
    navigate('/explorer' + (p.toString() ? '?' + p : ''), true)
  }

  const cats = useLoad(() => (type ? api.listCategories(type) : Promise.resolve([])), [type])
  const vitrines = useLoad(() => api.listVitrines({ type: type || undefined, categoryId: cat || undefined, q: debounced || undefined }), [type, cat, debounced])
  const items = useLoad(() => (debounced ? api.searchItems(debounced, type || undefined) : Promise.resolve([])), [type, debounced])

  return (
    <>
      <TopBar title="Explorer" />
      <div className="page stack" style={{ paddingTop: 0 }}>
        <div className="search">
          <Icon name="search" size={19} />
          <input autoFocus={!!params.q} value={q} onChange={(e) => setQ(e.target.value)}
            onBlur={() => setParam({ q })} placeholder="Tomates, coiffure, téléphone…" aria-label="Rechercher" />
          {q && <button aria-label="Effacer" onClick={() => { setQ(''); setParam({ q: '' }) }}><Icon name="x" size={18} /></button>}
        </div>

        <div className="chips" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={type === t.id} className={'chip ' + (type === t.id ? 'on' : '')}
              onClick={() => setParam({ type: t.id, cat: '' })}>{t.label}</button>
          ))}
        </div>

        {type && (cats.data?.length ?? 0) > 0 && (
          <div className="chips">
            <button className={'chip ' + (!cat ? 'on' : '')} onClick={() => setParam({ cat: '' })}>Toutes</button>
            {cats.data!.map((c) => (
              <button key={c.id} className={'chip ' + (cat === c.id ? 'on' : '')} onClick={() => setParam({ cat: c.id })}>
                <Icon name={c.icon} size={15} />{c.name}
              </button>
            ))}
          </div>
        )}

        {debounced && (items.data?.length ?? 0) > 0 && (
          <>
            <h2 style={{ marginTop: 18 }}>Articles</h2>
            <div className="card ilist">
              {items.data!.map((i) => (
                <a key={i.id} href={`#/v/${i.vitrine.slug}`} className="irow">
                  <div className="thumb"><Media src={i.image_url} type={i.vitrine.type} label={i.title} /></div>
                  <div className="grow">
                    <h3 className="ellipsis">{i.title}</h3>
                    <p className="price">{formatPrice(i.price, i.unit)}</p>
                    <p className="tiny muted ellipsis">{i.vitrine.name}</p>
                  </div>
                  <Icon name="chevron" className="muted" />
                </a>
              ))}
            </div>
          </>
        )}

        <h2 style={{ marginTop: 18 }}>
          Vitrines {vitrines.data ? <span className="muted small">({vitrines.data.length})</span> : null}
        </h2>
        {vitrines.loading && [0, 1, 2].map((i) => <Skeleton key={i} h={88} />)}
        {vitrines.error && <p className="alert err">{vitrines.error}</p>}
        <div className="stack vlist">{vitrines.data?.map((v) => <VitrineRow key={v.id} v={v} />)}</div>
        {!vitrines.loading && vitrines.data?.length === 0 && (
          <Empty icon="search" title="Aucun résultat" text="Essayez un autre mot ou une autre catégorie." />
        )}
      </div>
    </>
  )
}
