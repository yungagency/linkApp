import { Icon } from '../../components/Icon'
import { Empty, ItemCard, Logo, useLoad } from '../../components/ui'
import { PLANS, TYPES } from '../../config'
import { api } from '../../lib/api'
import { navigate } from '../../lib/router'
import { useSession } from '../../lib/session'
import { isPremiumActive } from '../../lib/utils'

export default function Dashboard() {
  const { vitrine: v } = useSession()
  const items = useLoad(() => (v ? api.listItems(v.id) : Promise.resolve([])), [v?.id])
  const orders = useLoad(() => (v ? api.sellerOrders() : Promise.resolve([])), [v?.id])
  const todo = (orders.data ?? []).filter((o) => ['placed', 'paid', 'preparing', 'shipped'].includes(o.status)).length
  if (!v) return null

  const t = TYPES[v.type]
  const premium = isPremiumActive(v)
  const list = items.data ?? []
  const limit = premium ? Infinity : PLANS[0]!.maxItems
  const full = list.length >= limit

  return (
    <>
      <header className="topbar home-top">
        <div className="grow"><Logo /></div>
        <a className="icon-btn" href="#/compte" aria-label="Mon compte"><Icon name="user" /></a>
      </header>
      <div className="page stack" style={{ paddingTop: 0 }}>
        <div className="row between">
          <div className="grow">
            <p className="small muted">{t.space}</p>
            <h1 className="ellipsis">{v.name}</h1>
          </div>
          <a className="btn ghost sm" href="#/pro/vitrine"><Icon name="edit" size={16} />Modifier</a>
        </div>
        {v.status === 'suspended' && <p className="alert err">Votre vitrine est suspendue par l'administration. Contactez l'équipe LinkApp.</p>}

        <section className={'premium-card ' + (premium ? '' : 'free')}>
          <div className="row between">
            <div>
              <p className="small" style={{ opacity: .8 }}>Votre abonnement</p>
              <h2 style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                {premium && <Icon name="crown" size={18} />}{premium ? 'Premium' : 'Gratuit'}
              </h2>
              <p className="small" style={{ opacity: .8, marginTop: 2 }}>
                {premium ? (v.premium_until ? `Actif jusqu'au ${new Date(v.premium_until).toLocaleDateString('fr-FR')}` : 'Actif')
                  : `${list.length}/${limit} ${t.itemSingular}s utilisés`}
              </p>
            </div>
            <a className="btn" href="#/pro/abonnement">{premium ? 'Gérer' : 'Passer Premium'}</a>
          </div>
        </section>

        <div className="stats">
          <div className="card stat"><b>{list.length}</b><span>{t.itemPlural.replace('Mes ', '')}</span></div>
          <div className="card stat"><b>{v.views}</b><span>Visites</span></div>
          <div className="card stat"><b>{list.filter((i) => i.available).length}</b><span>Disponibles</span></div>
        </div>

        <a className="card pad row" href="#/pro/commandes">
          <span className="ic" style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--green-bg)', color: 'var(--green)' }}><Icon name="box" size={18} /></span>
          <span className="grow"><b>Commandes reçues</b><br /><span className="tiny muted">{todo > 0 ? `${todo} à traiter` : 'Achats protégés de vos clients'}</span></span>
          {todo > 0 && <span className="badge secure">{todo}</span>}
          <Icon name="chevron" className="muted" />
        </a>

        <a className="card pad row" href={`#/v/${v.slug}`}>
          <span className="ic" style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'var(--blue-50)', color: 'var(--blue-600)' }}><Icon name="eye" size={18} /></span>
          <span className="grow"><b>Voir ma vitrine publique</b><br /><span className="tiny muted">C'est ce que voient vos clients</span></span>
          <Icon name="chevron" className="muted" />
        </a>

        <div className="section-head">
          <h2>{t.itemPlural}</h2>
          {list.length > 0 && <span className="small muted">{list.length}</span>}
        </div>
        {!items.loading && list.length === 0 && (
          <Empty icon={t.icon} title={`Ajoutez votre premier ${t.itemSingular}`} text="Une photo, un prix, et c'est en ligne." />
        )}
        <div className="items">
          {list.map((i) => <ItemCard key={i.id} item={i} type={v.type} onClick={() => navigate('/pro/article/' + i.id)} />)}
        </div>
        {full ? (
          <p className="alert warn">Limite du plan gratuit atteinte ({limit}). <a className="link" href="#/pro/abonnement">Passer Premium</a> pour en ajouter plus.</p>
        ) : (
          <a className="btn block" href="#/pro/article/new"><Icon name="plus" size={18} />{t.addLabel}</a>
        )}
      </div>
    </>
  )
}
