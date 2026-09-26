import { lazy, Suspense, useState } from 'react'
import { motion } from 'motion/react'
import { ArrowDownRight, ArrowRight, ArrowUpRight, BarChart3, Boxes, Check, ChevronRight, CircleDot, Globe2, Layers3, Package, ScanLine, ShoppingBag, ShoppingCart, Store, Users, WandSparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { Shape as FractalShape } from '../../glass-fractal/index'
import '../design/landing-page.css'

const rise = { initial: { opacity: 0, y: 18 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: .55, ease: [0.2, 0.7, 0.2, 1] as const } }
const GlassFractal = lazy(() => import('../../glass-fractal/index'))

const categories = [
  { name: 'Vêtements', note: 'Tailles, couleurs, collections', icon: '01' },
  { name: 'Beauté & parfum', note: 'Formats, nuances, gammes', icon: '02' },
  { name: 'Maison & déco', note: 'Variantes et références', icon: '03' },
  { name: 'Électronique', note: 'Modèles, séries, accessoires', icon: '04' },
]

function DashboardPreview() {
  return (
    <div className="dashboard-window">
      <div className="window-topline"><div className="window-brand"><span className="window-brand-mark"><img src="/stockwise-logo.png" alt="" /></span> stockwise</div><span className="window-date">MARDI, 24 SEPTEMBRE <span>·</span> VUE D’ENSEMBLE</span><div className="window-user">A</div></div>
      <div className="window-body">
        <aside className="mini-rail"><span className="rail-active"><BarChart3 size={15} /></span><span><ShoppingCart size={15} /></span><span><Package size={15} /></span><span><Users size={15} /></span><span className="rail-spacer" /><span><Layers3 size={15} /></span></aside>
        <div className="mini-content">
          <div className="mini-heading"><div><span className="mini-overline">VOTRE ACTIVITÉ</span><h3>Bonjour, Amine <span>✳</span></h3></div><button type="button">Cette semaine <ChevronRight size={12} /></button></div>
          <div className="mini-stats">
            <div className="mini-stat"><span>Ventes nettes</span><b>12 480 <small>MAD</small></b><em><span>↗ 8,4 %</span> vs. semaine passée</em><div className="sparkline spark-a"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div>
            <div className="mini-stat"><span>Commandes</span><b>38</b><em><span>↗ 5,1 %</span> vs. semaine passée</em><div className="sparkline spark-b"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div></div>
            <div className="mini-stat"><span>À réapprovisionner</span><b>06 <small>articles</small></b><em className="stat-muted">Seuil minimum atteint</em><div className="stock-meter"><i /></div></div>
          </div>
          <div className="mini-lower">
            <div className="mini-chart"><div className="mini-panel-title">Ventes sur la période <span>7 jours <ChevronRight size={10} /></span></div><div className="chart-grid"><div className="chart-y"><i>4k</i><i>3k</i><i>2k</i><i>1k</i></div><div className="chart-plot"><div className="chart-bars"><i/><i/><i/><i/><i/><i/><i/></div><div className="chart-labels"><i>LUN</i><i>MAR</i><i>MER</i><i>JEU</i><i>VEN</i><i>SAM</i><i>DIM</i></div></div></div></div>
            <div className="mini-activity"><div className="mini-panel-title">Dernières ventes <span>Tout voir <ArrowUpRight size={10} /></span></div><div className="activity-row"><span className="activity-bag"><ShoppingBag size={12}/></span><span><b>Commande #1048</b><small>En boutique · 11:42</small></span><strong>+ 690</strong></div><div className="activity-row"><span className="activity-bag purple"><Globe2 size={12}/></span><span><b>Commande #1047</b><small>En ligne · 10:18</small></span><strong>+ 1 240</strong></div><div className="activity-row"><span className="activity-bag amber"><ShoppingBag size={12}/></span><span><b>Commande #1046</b><small>En boutique · 09:56</small></span><strong>+ 385</strong></div></div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  const token = useAuthStore((state) => state.token)
  const entryPath = token ? '/dashboard' : '/login'
  const [fractalShape, setFractalShape] = useState<FractalShape>('fractal')

  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="landing-brand" to="/" aria-label="Stockwise, accueil">
          <span className="landing-brand-icon"><img src="/stockwise-logo.png" alt="" /></span>
          <span>stockwise<span className="brand-period">.</span></span>
        </Link>
        <nav className="landing-nav-links" aria-label="Navigation principale">
          <a href="#workflows">Le système</a>
          <a href="#catalogue">Tous les produits</a>
          <a href="#principles">Notre approche</a>
        </nav>
        <div className="landing-nav-actions">
          <Link className="landing-login" to={entryPath}>{token ? 'Ouvrir l’application' : 'Connexion'}</Link>
          <Link className="landing-nav-cta" to={entryPath}>Voir Stockwise <ArrowUpRight size={15} /></Link>
        </div>
      </header>

      <section
        className="landing-hero"
        onClickCapture={(event) => {
          if (event.target instanceof Element && event.target.closest('a, button')) {
            setFractalShape((shape) => shape === 'fractal' ? 'orb' : 'fractal')
          }
        }}
      >
        <div className="hero-fractal-backdrop" aria-hidden="true">
          <Suspense fallback={<div className="glass-fractal-loading"><span /><small>PRÉPARATION DU RENDU</small></div>}>
            <GlassFractal shape={fractalShape} showControls={false} />
          </Suspense>
        </div>
        <div className="hero-copy">
          <motion.div className="hero-eyebrow" {...rise}><span className="live-dot" /> GESTION DE BOUTIQUE, SANS DÉTOUR</motion.div>
          <motion.h1 {...rise} transition={{ ...rise.transition, delay: .06 }}>Le magasin et le web.<br /><span>Dans le même rythme.</span></motion.h1>
          <motion.p className="hero-description" {...rise} transition={{ ...rise.transition, delay: .12 }}>
            Stock, ventes, commandes et clients réunis dans un outil pensé pour le quotidien des commerces — quelle que soit leur spécialité.
          </motion.p>
          <motion.div className="hero-actions" {...rise} transition={{ ...rise.transition, delay: .18 }}>
            <Link className="button-ink" to={entryPath}>Explorer l’espace de travail <ArrowRight size={16} /></Link>
            <a className="button-quiet" href="#workflows"><span className="play-mark"><ArrowDownRight size={15} /></span> Voir comment ça fonctionne</a>
          </motion.div>
          <div className="hero-shape-status" aria-live="polite"><span className="shape-status-dot"/><span>APERÇU INTERACTIF</span><i/><b>{fractalShape === 'fractal' ? 'FRACTAL' : 'ORB'}</b><small>CLIQUEZ SUR UNE ACTION POUR CHANGER</small></div>
          <motion.div className="hero-footnote" {...rise} transition={{ ...rise.transition, delay: .24 }}>
            <span className="footnote-rule" /> Une vue claire. Des actions simples. Vos données restent les vôtres.
          </motion.div>
        </div>

        <motion.div className="hero-product" initial={{ opacity: 0, y: 24, rotate: 1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: .75, delay: .16, ease: 'easeOut' }}>
          <div className="product-orbit orbit-one" /><div className="product-orbit orbit-two" />
          <DashboardPreview />
          <div className="float-note note-stock"><span className="note-icon"><Boxes size={15}/></span><span><b>Stock synchronisé</b><small>Local · En ligne</small></span><Check size={14} className="note-check" /></div>
          <div className="float-note note-order"><span className="note-order-icon"><Globe2 size={14}/></span><span><b>Nouvelle commande</b><small>Reçue à l’instant</small></span><span className="order-pulse" /></div>
          <span className="hero-index">01 <i /> 04</span>
        </motion.div>
      </section>

      <section className="signal-strip" aria-label="Canaux de vente"><span>UN MÊME OUTIL POUR</span><div><Store size={15}/> <b>VOTRE MAGASIN</b></div><i/><div><Globe2 size={15}/> <b>VOTRE BOUTIQUE EN LIGNE</b></div><i/><div><Layers3 size={15}/> <b>VOTRE CATALOGUE</b></div><span className="strip-tail">AUCUNE SPÉCIALITÉ IMPOSÉE</span></section>

      <section className="workflow-section" id="workflows">
        <motion.div className="section-heading" {...rise}><div><span className="section-kicker">UN SEUL FLUX, DU COMPTOIR À LA LIVRAISON</span><h2>Le travail avance.<br/><span>Les outils suivent.</span></h2></div><p>Pas besoin de jongler entre vos ventes et votre stock. Chaque partie de votre activité s’appuie sur les mêmes informations.</p></motion.div>
        <div className="workflow-grid">
          <motion.article className="workflow-card workflow-pos" {...rise}><div className="card-topline"><span className="card-number">01 / EN MAGASIN</span><span className="round-arrow"><ArrowUpRight size={16}/></span></div><div className="workflow-visual pos-visual"><div className="receipt-sheet"><div className="receipt-head"><span>MAISON / ATELIER</span><span>24.09 — 11:42</span></div><div className="receipt-item"><i className="swatch swatch-cream"/><span>Veste en laine<small>Beige · M</small></span><b>1 290</b></div><div className="receipt-item"><i className="swatch swatch-violet"/><span>Écharpe mérinos<small>Prune · Taille unique</small></span><b>390</b></div><div className="receipt-total"><span>TOTAL TTC</span><b>1 680 <small>MAD</small></b></div><div className="receipt-paid"><Check size={12}/> Paiement enregistré</div></div><div className="scan-stamp"><ScanLine size={21}/><span>VENTE<br/>RAPIDE</span></div></div><h3>Une caisse qui suit le rythme</h3><p>Ajoutez un article, encaissez, imprimez. Le stock se met à jour au même moment.</p><div className="card-tags"><span>Point de vente</span><span>Tickets</span><span>Retours</span></div></motion.article>
          <motion.article className="workflow-card workflow-online" {...rise} transition={{ ...rise.transition, delay: .08 }}><div className="card-topline"><span className="card-number">02 / EN LIGNE</span><span className="round-arrow"><ArrowUpRight size={16}/></span></div><div className="workflow-visual orders-visual"><div className="order-stack"><div className="order-stack-head"><span>FILE DE COMMANDES</span><span className="order-count">03</span></div><div className="order-ticket"><i className="order-avatar avatar-lilac">SB</i><span><b>#1048 · Sara B.</b><small>2 articles · Casablanca</small></span><em>À traiter</em></div><div className="order-ticket"><i className="order-avatar avatar-moss">YH</i><span><b>#1047 · Youssef H.</b><small>1 article · Rabat</small></span><em className="ticket-confirmed">Confirmée</em></div><div className="order-ticket"><i className="order-avatar avatar-peach">NK</i><span><b>#1046 · Nora K.</b><small>3 articles · Tanger</small></span><em>À traiter</em></div></div><div className="sync-bubble"><span className="live-dot"/> EN DIRECT</div></div><h3>Gardez chaque commande en vue</h3><p>Retrouvez les nouvelles commandes et leur avancement dans une file simple à suivre.</p><div className="card-tags"><span>Commandes</span><span>Suivi</span><span>Clients</span></div></motion.article>
          <motion.article className="workflow-card workflow-stock" {...rise} transition={{ ...rise.transition, delay: .16 }}><div className="card-topline"><span className="card-number">03 / EN RÉSERVE</span><span className="round-arrow"><ArrowUpRight size={16}/></span></div><div className="workflow-visual inventory-visual"><div className="inventory-card"><div className="inventory-head"><span>VUE DU STOCK</span><span>24 RÉFÉRENCES</span></div><div className="inventory-line"><span className="product-marker marker-ink"/><span><b>Veste en laine</b><small>VT-204 · Beige / M</small></span><div className="qty"><b>12</b><i><u style={{width:'74%'}}/></i></div></div><div className="inventory-line"><span className="product-marker marker-plum"/><span><b>Extrait de parfum</b><small>PF-108 · Ambre · 50 ml</small></span><div className="qty"><b>08</b><i><u style={{width:'48%'}}/></i></div></div><div className="inventory-line low-stock"><span className="product-marker marker-clay"/><span><b>Lampe de table</b><small>DE-032 · Terre cuite</small></span><div className="qty"><b>02</b><i><u style={{width:'18%'}}/></i></div></div><div className="inventory-foot"><span><CircleDot size={11}/> 1 seuil à surveiller</span><ArrowRight size={13}/></div></div></div><h3>Sachez ce qu’il vous reste</h3><p>Un catalogue souple pour vos références, variantes, niveaux de stock et réapprovisionnements.</p><div className="card-tags"><span>Catalogue</span><span>Variantes</span><span>Alertes</span></div></motion.article>
        </div>
      </section>

      <section className="catalogue-section" id="catalogue"><div className="catalogue-layout"><motion.div className="catalogue-copy" {...rise}><span className="section-kicker">VOTRE MÉTIER, VOS RÈGLES</span><h2>Un catalogue qui ne vous met pas dans une case.</h2><p>Chaussures, vêtements, parfum, décoration, accessoires ou matériel : organisez vos produits comme vous en avez besoin.</p><Link className="text-link" to={entryPath}>Voir le catalogue en action <ArrowRight size={15}/></Link><div className="catalogue-note"><WandSparkles size={16}/><span><b>Variantes à votre façon.</b> Taille, couleur, contenance ou référence : gardez les détails utiles à votre équipe.</span></div></motion.div><motion.div className="category-board" {...rise}><div className="board-caption"><span>EXEMPLES DE RAYONS</span><span>01 — 04</span></div>{categories.map((category) => <div className="category-row" key={category.name}><span className="category-num">{category.icon}</span><span className="category-name">{category.name}</span><span className="category-note">{category.note}</span><ArrowUpRight size={15}/></div>)}<div className="board-foot"><span><Package size={13}/> Vos familles de produits restent personnalisables</span><span>À VOUS DE COMPOSER <ArrowRight size={12}/></span></div></motion.div></div></section>

      <section className="principles-section" id="principles"><motion.div className="principles-title" {...rise}><span className="section-kicker">CONÇU POUR LE VRAI QUOTIDIEN</span><h2>Moins de bruit.<br/><span>Plus de maîtrise.</span></h2></motion.div><div className="principles-list"><motion.div className="principle-row" {...rise}><span>01</span><div><h3>Les actions à leur place</h3><p>Vendre, retrouver une référence ou vérifier une commande sans traverser dix écrans.</p></div><ChevronRight size={18}/></motion.div><motion.div className="principle-row" {...rise}><span>02</span><div><h3>Une vue cohérente</h3><p>Les données produit et stock structurent votre activité en magasin comme en ligne.</p></div><ChevronRight size={18}/></motion.div><motion.div className="principle-row" {...rise}><span>03</span><div><h3>Vous gardez la main</h3><p>Des chiffres lisibles et des outils pratiques, sans promesses opaques ni jargon.</p></div><ChevronRight size={18}/></motion.div></div></section>

      <section className="closing-section"><div className="closing-mark"><img src="/stockwise-logo.png" alt="" /></div><div><span className="section-kicker">PRÊT À VOIR SI ÇA VOUS CONVIENT ?</span><h2>Entrez. Regardez. Décidez.</h2><p>Explorez l’espace de travail et voyez comment il s’adapte à votre commerce.</p></div><Link className="closing-cta" to={entryPath}>{token ? 'Ouvrir Stockwise' : 'Accéder à Stockwise'} <ArrowUpRight size={16}/></Link><div className="closing-orbit"/></section>

      <footer className="landing-footer"><Link className="landing-brand" to="/"><span className="landing-brand-icon"><img src="/stockwise-logo.png" alt="" /></span><span>stockwise<span className="brand-period">.</span></span></Link><span>Un seul espace pour faire tourner votre boutique.</span><div><a href="#workflows">Le système</a><a href="#catalogue">Catalogue</a><Link to="/login">Connexion</Link></div><small>© {new Date().getFullYear()} Stockwise</small></footer>
    </main>
  )
}
