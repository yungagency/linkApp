import { TopBar } from '../components/ui'
import { APP } from '../config'
import { CONFIRM_DAYS } from '../lib/orders'
import { formatPrice } from '../lib/utils'

/** Règles publiques de LinkApp Assurance et des litiges (à faire relire par un juriste). */
export default function Rules() {
  const N = APP.protectionName
  return (
    <>
      <TopBar back title={N} />
      <div className="page rules">
        <p>{N} protège votre argent quand vous achetez sur LinkApp. C’est facultatif : vous pouvez toujours commander sans, et payer le vendeur directement.</p>

        <h2>Comment ça marche</h2>
        <ul>
          <li>Vous payez par Orange Money ou MTN Mobile Money via CinetPay.</li>
          <li>LinkApp bloque l’argent. Le vendeur est prévenu que vous avez payé.</li>
          <li>Le vendeur livre dans le délai annoncé sur l’article.</li>
          <li>À la remise, vous donnez votre <b>code de réception</b> à 4 chiffres, seulement si tout est conforme.</li>
          <li>Vous confirmez la réception : l’argent est versé au vendeur.</li>
        </ul>

        <h2>Qui peut en profiter</h2>
        <ul>
          <li>Les vendeurs <b>vérifiés</b> par LinkApp (pièce d’identité contrôlée).</li>
          <li>Les commandes jusqu’à <b>{formatPrice(APP.assuranceMax)}</b>.</li>
        </ul>

        <h2>Retard de livraison</h2>
        <p>Si le délai annoncé est dépassé, vous pouvez demander le remboursement depuis votre commande. LinkApp contacte le vendeur avant de décider.</p>

        <h2>Litige</h2>
        <ul>
          <li>Ouvert par le client tant qu’il n’a pas confirmé la réception, et au plus tard {CONFIRM_DAYS} jours après la livraison.</li>
          <li>L’argent reste bloqué pendant le litige.</li>
          <li>Chacun dépose ses preuves : photos de l’article, de l’emballage, bordereau d’agence, captures de conversation.</li>
          <li>LinkApp décide sous 72 h : remboursement du client ou versement au vendeur.</li>
          <li>Un code de réception donné au livreur vaut confirmation de la remise. Un litige reste possible sur la qualité ou la conformité.</li>
        </ul>

        <h2>Ce qui n’est pas couvert</h2>
        <ul>
          <li>Les commandes passées <b>sans assurance</b> ou réglées en dehors de l’application.</li>
          <li>Un changement d’avis sans défaut de l’article ou du service.</li>
        </ul>

        <h2>Frais</h2>
        <p>Pour le client, la protection est incluse dans le prix. LinkApp prélève une commission de {Math.round(APP.commissionRate * 100)} % sur le montant versé au vendeur.</p>

        <p className="tiny muted" style={{ marginTop: 24 }}>Document provisoire, à valider juridiquement avant le lancement public.</p>
      </div>
    </>
  )
}
