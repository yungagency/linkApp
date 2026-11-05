import { useState, type ChangeEvent } from 'react'
import { Logo, TopBar } from '../components/ui'
import { api } from '../lib/api'
import { navigate } from '../lib/router'
import { useSession } from '../lib/session'
import { errorMessage } from '../lib/utils'

export function Login({ next }: { next?: string }) {
  const { refresh } = useSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <>
      <TopBar back="/" />
      <form className="page stack" onSubmit={async (e) => {
        e.preventDefault(); setErr(''); setBusy(true)
        try { await api.signIn(email.trim(), password); await refresh(); navigate(next || '/compte', true) }
        catch (x) { setErr(errorMessage(x)) } finally { setBusy(false) }
      }}>
        <Logo size={40} />
        <h1 style={{ marginTop: 18 }}>Bon retour 👋</h1>
        <p className="muted">Connectez-vous pour gérer votre vitrine.</p>
        <label className="field"><span>Email</span>
          <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field"><span>Mot de passe</span>
          <input className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {err && <p className="alert err">{err}</p>}
        <button className="btn block" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
        <p className="center small muted">Pas encore de compte ?{' '}
          <a className="link" href={'#/inscription' + (next ? '?next=' + encodeURIComponent(next) : '')}>Créer un compte</a>
        </p>
        {api.mode === 'demo' && (
          <p className="alert info small">
            Mode démo — compte admin : <b>admin@demo.linkapp</b> / <b>admin123</b>. Vous pouvez aussi créer un compte de test.
          </p>
        )}
      </form>
    </>
  )
}

export function Register({ next }: { next?: string }) {
  const { refresh } = useSession()
  const [f, setF] = useState({ full_name: '', phone: '', email: '', password: '' })
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  return (
    <>
      <TopBar back="/connexion" />
      <form className="page stack" onSubmit={async (e) => {
        e.preventDefault(); setErr(''); setInfo(''); setBusy(true)
        try {
          await api.signUp({ ...f, email: f.email.trim() })
          const p = await api.getProfile()
          if (!p) { setInfo('Compte créé. Ouvrez le lien de confirmation reçu par email, puis connectez-vous.'); return }
          await refresh()
          navigate(next || '/pro/vitrine', true)
        } catch (x) { setErr(errorMessage(x)) } finally { setBusy(false) }
      }}>
        <h1>Créer un compte</h1>
        <p className="muted">Gratuit. Vous pourrez ensuite ouvrir votre vitrine en 2 minutes.</p>
        <label className="field"><span>Nom complet</span>
          <input className="input" required autoComplete="name" value={f.full_name} onChange={set('full_name')} />
        </label>
        <label className="field"><span>Téléphone (WhatsApp)</span>
          <input className="input" type="tel" inputMode="tel" placeholder="6XX XX XX XX" autoComplete="tel" value={f.phone} onChange={set('phone')} />
        </label>
        <label className="field"><span>Email</span>
          <input className="input" type="email" required autoComplete="email" value={f.email} onChange={set('email')} />
        </label>
        <label className="field"><span>Mot de passe</span>
          <input className="input" type="password" required minLength={6} autoComplete="new-password" value={f.password} onChange={set('password')} />
          <p className="hint">6 caractères minimum.</p>
        </label>
        {err && <p className="alert err">{err}</p>}
        {info && <p className="alert ok">{info}</p>}
        <button className="btn block" disabled={busy}>{busy ? 'Création…' : 'Créer mon compte'}</button>
        <p className="center small muted">Déjà inscrit ? <a className="link" href="#/connexion">Se connecter</a></p>
      </form>
    </>
  )
}
