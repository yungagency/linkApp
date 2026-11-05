import { useState } from 'react'
import { Icon } from '../components/Icon'
import { Empty, Media, Skeleton, TopBar, VitrineRow, useLoad } from '../components/ui'
import { TYPES } from '../config'
import { api } from '../lib/api'
import type { VitrineType } from '../lib/types'
import { formatPrice } from '../lib/utils'

const GROUP: Record<VitrineType, string> = { commerce: 'Boutiques', agriculture: 'Produits agricoles', service: 'Services' }

/** Toutes les catégories, regroupées par univers. */
export function Categories() {
  const cats = useLoad(() => api.listCategories(), [])
  return (
    <>
      <TopBar title="Catégories" back="/" />
      <div className="page">
        {cats.loading && <Skeleton h={220} />}
        {(Object.keys(TYPES) as VitrineType[]).map((t) => {
          const list = (cats.data ?? []).filter((c) => c.type === t)
          if (!list.length) return null
          return (
            <section key={t}>
              <div className="section-head"><h2 className="row" style={{ gap: 8 }}>
                <span className={`badge t-${t}`} style={{ padding: 6 }}><Icon name={TYPES[t].icon} size={16} /></span>{GROUP[t]}
              </h2></div>
              <div className="cat-list">
                {list.map((c) => (
                  <a key={c.id} className="card cat-card" href={`#/categorie/${c.id}`}>
                    <span className={`ic t-${t}`}><Icon name={c.icon} size={20} /></span>
                    <span className="grow ellipsis">{c.name}</span>
                    <Icon name="chevron" size={18} className="muted" />
                  </a>
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </>
  )
}

/** Une catégorie : ses articles (produits, cultures, services) et ses vitrines. */
export function CategoryPage({ id }: { id: string }) {
  const [tab, setTab] = useState<'items' | 'vitrines'>('items')
  const cat = useLoad(() => api.getCategory(id), [id])
  const items = useLoad(() => api.listItemsByCategory(id), [id])
  const vitrines = useLoad(() => api.listVitrines({ categoryId: id }), [id])
  const c = cat.data

  if (!cat.loading && !c) return <><TopBar back="/categories" title="Catégorie" /><Empty title="Catégorie introuvable" /></>
  const type = c?.type ?? 'commerce'
  const nItems = items.data?.length ?? 0
  const nVit = vitrines.data?.length ?? 0

  return (
    <>
      <TopBar back="/categories" title={c?.name ?? ''} />
      <div className="page stack" style={{ paddingTop: 0 }}>
        {c && (
          <div className="cat-hero">
            <span className={`ic t-${type}`}><Icon name={c.icon} size={26} /></span>
            <div>
              <p className="tiny" style={{ color: '#93C5FD', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 600 }}>{GROUP[type]}</p>
              <h2 style={{ color: '#fff' }}>{c.name}</h2>
              <p className="small" style={{ color: '#A3AFC2' }}>{nItems} {TYPES[type].itemSingular}{nItems > 1 ? 's' : ''} · {nVit} vitrine{nVit > 1 ? 's' : ''}</p>
            </div>
          </div>
        )}
        <div className="chips" role="tablist">
          <button role="tab" aria-selected={tab === 'items'} className={'chip ' + (tab === 'items' ? 'on' : '')} onClick={() => setTab('items')}>
            {TYPES[type].itemPlural.replace('Mes ', '').replace(/^./, (x) => x.toUpperCase())}
          </button>
          <button role="tab" aria-selected={tab === 'vitrines'} className={'chip ' + (tab === 'vitrines' ? 'on' : '')} onClick={() => setTab('vitrines')}>Vitrines</button>
        </div>

        {tab === 'items' && (
          <>
            {items.loading && <div className="items"><Skeleton h={200} /><Skeleton h={200} /></div>}
            {!items.loading && nItems === 0 && <Empty icon={c?.icon} title="Rien pour l'instant dans cette catégorie" text="Revenez bientôt, de nouveaux vendeurs arrivent." />}
            <div className="items">
              {(items.data ?? []).map((i) => (
                <a key={i.id} className="card icard" href={`#/v/${i.vitrine.slug}`}>
                  <div className="img">
                    <Media src={i.image_url} type={i.vitrine.type} label={i.title} />
                    {!i.available && <span className="badge off float">Indisponible</span>}
                  </div>
                  <div className="body">
                    <h3 className="ellipsis" style={{ fontSize: 14 }}>{i.title}</h3>
                    <p className="price">{formatPrice(i.price, i.unit)}</p>
                    <p className="tiny muted ellipsis row" style={{ gap: 4 }}><Icon name="store" size={12} />{i.vitrine.name}</p>
                  </div>
                </a>
              ))}
            </div>
          </>
        )}

        {tab === 'vitrines' && (
          <>
            {vitrines.loading && <Skeleton h={88} />}
            {!vitrines.loading && nVit === 0 && <Empty icon="store" title="Aucune vitrine dans cette catégorie" />}
            <div className="stack vlist">{(vitrines.data ?? []).map((v) => <VitrineRow key={v.id} v={v} />)}</div>
          </>
        )}
      </div>
    </>
  )
}
