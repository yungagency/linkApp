import { useState } from 'react'
import { Icon } from '../components/Icon'
import { InstallButton } from '../components/Install'
import { Logo, Skeleton, VitrineCard, VitrineRow, useFavs, useLoad } from '../components/ui'
import { APP, TYPES } from '../config'
import { api } from '../lib/api'
import { navigate } from '../lib/router'
import { useSession } from '../lib/session'
import type { VitrineType } from '../lib/types'

export default function Home() {
  const favs = useFavs()
  const { vitrine } = useSession()
  const [q, setQ] = useState('')
  const featured = useLoad(() => api.listVitrines({ limit: 8 }), [])
  const cats = useLoad(() => api.listCategories('commerce'), [])

  const list = featured.data ?? []
  const top = list.filter((v) => v.is_premium).slice(0, 6)
  const recent = list.slice(0, 5)

  return (
    <>
      <header className="topbar home-top">
        <div className="grow"><Logo size={32} /></div>
        <InstallButton />
      </header>

      <div className="page" style={{ paddingTop: 4 }}>
        <p className="row small muted" style={{ gap: 4, marginBottom: 10 }}>
          <Icon name="pin" size={15} />{APP.defaultCity}, Cameroun
        </p>

        <form className="search home-search" onSubmit={(e) => { e.preventDefault(); navigate('/explorer?q=' + encodeURIComponent(q)) }}>
          <Icon name="search" size={19} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un produit, une boutique, un service…" aria-label="Rechercher" />
        </form>

        <section className="hero" style={{ marginTop: 16 }}>
          <img src="./logo-mark.png" alt="" className="hero-deco" />
          <p className="eyebrow">Confiance · Proximité · Croissance</p>
          <h2>Soutenez les entrepreneurs locaux</h2>
          <p>Boutiques, produits agricoles et services près de chez vous, en contact direct sur WhatsApp.</p>
          <a className="btn" href="#/explorer">Découvrir</a>
        </section>

        <div className="section-head"><h2>Je cherche</h2></div>
        <div className="types">
          {(Object.keys(TYPES) as VitrineType[]).map((t) => (
            <a key={t} className="type-tile" href={`#/explorer?type=${t}`}>
              <span className={`ic t-${t}`}><Icon name={TYPES[t].icon} size={22} /></span>
              {t === 'commerce' ? 'Boutiques' : t === 'agriculture' ? 'Produits agricoles' : 'Services'}
            </a>
          ))}
        </div>

        <div className="section-head">
          <h2>Catégories</h2>
          <a className="link" href="#/explorer">Voir tout</a>
        </div>
        <div className="cat-grid">
          {(cats.data ?? []).slice(0, 8).map((c) => (
            <a key={c.id} className="cat" href={`#/explorer?type=${c.type}&cat=${c.id}`}>
              <span className="ic"><Icon name={c.icon} size={22} /></span>{c.name}
            </a>
          ))}
        </div>

        {(featured.loading || top.length > 0) && (
          <>
            <div className="section-head">
              <h2>À la une</h2>
              <a className="link" href="#/explorer">Voir tout</a>
            </div>
            <div className="h-scroll">
              {featured.loading
                ? [0, 1].map((i) => <Skeleton key={i} h={190} />)
                : top.map((v) => <VitrineCard key={v.id} v={v} favs={favs} />)}
            </div>
          </>
        )}

        <div className="section-head"><h2>Nouveautés</h2></div>
        <div className="stack vlist">
          {featured.loading && [0, 1, 2].map((i) => <Skeleton key={i} h={88} />)}
          {featured.error && <p className="alert err">{featured.error}</p>}
          {recent.map((v) => <VitrineRow key={v.id} v={v} />)}
          {!featured.loading && !featured.error && list.length === 0 && (
            <p className="alert info">Aucune vitrine pour le moment.</p>
          )}
        </div>

        {!vitrine && (
          <a className="card pad row" href="#/devenir-vendeur" style={{ marginTop: 22 }}>
            <span className="type-tile" style={{ padding: 0, boxShadow: 'none' }}><span className="ic t-commerce"><Icon name="store" size={20} /></span></span>
            <span className="grow"><b>Vous vendez ?</b><br /><span className="small muted">Ouvrez votre vitrine gratuitement</span></span>
            <Icon name="chevron" className="muted" />
          </a>
        )}
      </div>
    </>
  )
}
