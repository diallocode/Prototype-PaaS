<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'

// URL de l'API web (server.js). Modifiable via un fichier .env : VITE_API_URL=http://mon-serveur:3000
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const load = (k) => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }
const save = (k, v) => { try { v ? localStorage.setItem(k, JSON.stringify(v)) : localStorage.removeItem(k) } catch {} }

const user = ref(load('paas_user'))
const session = ref(load('paas_session'))
const tab = ref('login')
const loading = ref(false)
const error = ref('')
const embed = ref(false)
const copied = ref(false)
const now = ref(Date.now())
const duree = ref(30)
const durees = [10, 30, 60, 120]

const login = reactive({ nom: '', md: '' })
const signup = reactive({ nom: '', prenom: '', md: '', temps: 30 })

let timer
onMounted(() => { timer = setInterval(() => (now.value = Date.now()), 1000) })
onUnmounted(() => clearInterval(timer))

async function post(path, body) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || data.message || `Erreur ${res.status}`)
  return data
}

async function run(fn) {
  loading.value = true
  error.value = ''
  try { await fn() }
  catch (e) {
    error.value = e.message === 'Failed to fetch'
      ? `Le serveur ne répond pas. Vérifiez que l'API est démarrée sur ${API}.`
      : e.message
  } finally { loading.value = false }
}

function setSession(info) {
  session.value = { worker: info.worker, app_url: info.app_url, expires_at: info.expires_at, started_at: Date.now(), specs: info.specs || null }
  save('paas_session', session.value)
}

const doLogin = () => run(async () => {
  const data = await post('/login', { nom: login.nom, md: login.md })
  user.value = data.client
  save('paas_user', user.value)
})

const doSignup = () => run(async () => {
  const data = await post('/clients', { ...signup })
  user.value = data.client
  save('paas_user', user.value)
})

const reserve = () => run(async () => {
  const data = await post('/reserver', { duree: duree.value, clientNom: user.value.nom })
  setSession(data.workerInfo)
})

const extendSession = (minutes) => run(async () => {
  const data = await post('/prolonger', { clientNom: user.value.nom, extraMinutes: minutes })
  if (session.value) {
    session.value.expires_at = data.data.expires_at
    save('paas_session', session.value)
  }
})

function logout() {
  user.value = null
  session.value = null
  embed.value = false
  save('paas_user', null)
  save('paas_session', null)
}

const remaining = computed(() => session.value ? Math.max(0, session.value.expires_at - now.value) : 0)
const active = computed(() => session.value && remaining.value > 0)
const clock = computed(() => {
  const s = Math.floor(remaining.value / 1000)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const p = (n) => String(n).padStart(2, '0')
  return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`
})
const progress = computed(() => {
  if (!session.value) return 0
  const total = session.value.expires_at - session.value.started_at
  return total > 0 ? Math.min(100, (remaining.value / total) * 100) : 0
})
const specs = computed(() => {
  const s = session.value?.specs
  if (!s) return []
  const go = (mb) => (mb >= 1024 ? (mb / 1024).toFixed(mb % 1024 ? 1 : 0) : mb) + (mb >= 1024 ? ' Go' : ' Mo')
  return [
    { k: 'Système', v: s.os || 'Inconnu', wide: true },
    { k: 'Processeurs', v: s.cpu ? `${s.cpu} vCPU` : '—' },
    { k: 'Mémoire', v: s.ram_mb ? go(s.ram_mb) : '—' },
    { k: 'Disque', v: s.disk_gb ? `${s.disk_gb} Go` : '—' },
  ]
})
const urgent = computed(() => active.value && remaining.value < 60000)

async function copyUrl() {
  try { await navigator.clipboard.writeText(session.value.app_url); copied.value = true; setTimeout(() => (copied.value = false), 1500) } catch {}
}
</script>

<template>
  <!-- ============ Écran d'accueil / authentification ============ -->
  <main v-if="!user" class="auth">
    <section class="intro">
      <p class="brand">PaaS Control Plane</p>
      <h1>Un terminal Linux à vous, le temps qu'il vous faut.</h1>
      <p class="lead">Choisissez une durée, on vous réserve une machine isolée avec un terminal dans le navigateur. Vos fichiers sont conservés dans votre dossier personnel.</p>

      <div class="term" aria-hidden="true">
        <div class="term-bar"><i></i><i></i><i></i></div>
        <pre><span class="l l1"><b>$</b> reserver --duree 30</span>
<span class="l l2">Recherche d'un worker libre…</span>
<span class="l l3">worker-2 alloué. Bail de 30 min.</span>
<span class="l l4"><b>$</b> <em class="cursor"></em></span></pre>
      </div>
    </section>

    <section class="panel">
      <div class="tabs" role="tablist">
        <button role="tab" :aria-selected="tab === 'login'" :class="{ on: tab === 'login' }" @click="tab = 'login'; error = ''">Connexion</button>
        <button role="tab" :aria-selected="tab === 'signup'" :class="{ on: tab === 'signup' }" @click="tab = 'signup'; error = ''">Créer un compte</button>
      </div>

      <form v-if="tab === 'login'" @submit.prevent="doLogin">
        <label>Nom d'utilisateur<input v-model.trim="login.nom" required autocomplete="username" /></label>
        <label>Mot de passe<input v-model="login.md" type="password" required autocomplete="current-password" /></label>
        <p v-if="error" class="err" role="alert">{{ error }}</p>
        <button class="btn" :disabled="loading">{{ loading ? 'Connexion…' : 'Se connecter' }}</button>
      </form>

      <form v-else @submit.prevent="doSignup">
        <div class="row">
          <label>Prénom<input v-model.trim="signup.prenom" required autocomplete="given-name" /></label>
          <label>Nom<input v-model.trim="signup.nom" required autocomplete="family-name" /></label>
        </div>
        <label>Mot de passe<input v-model="signup.md" type="password" required autocomplete="new-password" /></label>
        <fieldset>
          <legend>Durée de votre première session</legend>
          <div class="chips">
            <label v-for="d in durees" :key="d" :class="{ on: signup.temps === d }">
              <input type="radio" v-model="signup.temps" :value="d" /> {{ d }} min
            </label>
          </div>
        </fieldset>
        <p v-if="error" class="err" role="alert">{{ error }}</p>
        <button class="btn" :disabled="loading">{{ loading ? 'Création et déploiement…' : 'Créer mon compte et démarrer' }}</button>
      </form>
    </section>
  </main>

  <!-- ============ Tableau de bord ============ -->
  <div v-else class="dash">
    <header class="top">
      <p class="brand">PaaS Control Plane</p>
      <div class="who">
        <span>{{ user.prenom }} {{ user.nom }}</span>
        <button class="ghost" @click="logout">Se déconnecter</button>
      </div>
    </header>

    <main class="grid">
      <section class="card">
        <h2>Nouvelle session</h2>
        <p class="muted">Un worker libre vous est attribué pour la durée choisie. À l'expiration, la machine est nettoyée et remise à disposition.</p>

        <fieldset>
          <legend>Durée</legend>
          <div class="chips big">
            <label v-for="d in durees" :key="d" :class="{ on: duree === d }">
              <input type="radio" v-model="duree" :value="d" /> {{ d >= 60 ? d / 60 + ' h' : d + ' min' }}
            </label>
          </div>
        </fieldset>

        <p v-if="error" class="err" role="alert">{{ error }}</p>
        <button class="btn" :disabled="loading || active" @click="reserve">
          {{ loading ? 'Allocation en cours…' : active ? 'Une session est déjà active' : 'Lancer mon environnement' }}
        </button>
      </section>

      <section class="ticket" :class="{ off: !active, urgent }">
        <template v-if="active">
          <div class="ticket-head">
            <span class="dot"></span> Session active sur {{ session.worker }}
          </div>
          <p class="clock" role="timer">{{ clock }}</p>
          <p class="muted">temps restant avant libération de la machine</p>
          <div class="bar"><span :style="{ width: progress + '%' }"></span></div>

          <div class="perf" aria-hidden="true"></div>

          <dl v-if="specs.length" class="specs">
            <div v-for="i in specs" :key="i.k" :class="{ wide: i.wide }">
              <dt>{{ i.k }}</dt>
              <dd>{{ i.v }}</dd>
            </div>
          </dl>

          <div class="addr">
            <code>{{ session.app_url }}</code>
            <button class="ghost" @click="copyUrl">{{ copied ? 'Copié' : 'Copier' }}</button>
          </div>
          <div class="actions">
            <a class="btn" :href="session.app_url" target="_blank" rel="noopener">Ouvrir le terminal</a>
            <button class="ghost" @click="extendSession(15)">+ 15 min</button>
            <button class="ghost" @click="embed = !embed">{{ embed ? 'Masquer l\'aperçu' : 'Afficher ici' }}</button>
          </div>
        </template>
        <template v-else>
          <p class="empty-title">Aucune session en cours</p>
          <p class="muted">Choisissez une durée et lancez votre environnement : votre ticket apparaîtra ici avec le compte à rebours.</p>
        </template>
      </section>

      <section v-if="active && embed" class="frame">
        <iframe :src="session.app_url" title="Terminal de votre session"></iframe>
      </section>
    </main>
  </div>
</template>

<style>
:root {
  --fog: #e8ecf2; --paper: #f8f9fc; --ink: #151c2b; --mute: #5d6779; --line: #cfd6e2;
  --cobalt: #2445e8; --cobalt-d: #1a34b8; --sky: #8da2ff; --red: #c8352e;
  --mono: 'IBM Plex Mono', ui-monospace, Menlo, Consolas, monospace;
  --sans: 'Bricolage Grotesque', 'Segoe UI', system-ui, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body { background: var(--fog); color: var(--ink); font-family: var(--sans); font-size: 16px; line-height: 1.5; }
h1, h2, p { margin: 0; }
button, input { font: inherit; color: inherit; }
:focus-visible { outline: 3px solid var(--cobalt); outline-offset: 2px; }

.brand { font-weight: 700; letter-spacing: -.01em; }
.muted { color: var(--mute); max-width: 52ch; }
.err { color: var(--red); font-size: .95rem; }

/* Boutons */
.btn { display: inline-block; text-align: center; text-decoration: none; background: var(--cobalt); color: #fff; border: 0; border-radius: 10px; padding: .85rem 1.3rem; font-weight: 600; cursor: pointer; transition: background .15s; }
.btn:hover:not(:disabled) { background: var(--cobalt-d); }
.btn:disabled { background: #9aa6c9; cursor: not-allowed; }
.ghost { background: transparent; border: 1px solid var(--line); border-radius: 10px; padding: .5rem .9rem; cursor: pointer; }
.ghost:hover { border-color: var(--ink); }

/* Formulaires */
form { display: grid; gap: 1rem; }
label { display: grid; gap: .3rem; font-size: .92rem; font-weight: 500; }
input:not([type=radio]) { background: #fff; border: 1px solid var(--line); border-radius: 8px; padding: .7rem .8rem; }
input:not([type=radio]):focus { border-color: var(--cobalt); outline: none; box-shadow: 0 0 0 3px #2445e830; }
.row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
fieldset { border: 0; padding: 0; margin: 0; }
legend { font-size: .92rem; font-weight: 500; margin-bottom: .5rem; padding: 0; }
.chips { display: flex; flex-wrap: wrap; gap: .5rem; }
.chips label { display: block; position: relative; border: 1px solid var(--line); border-radius: 999px; padding: .4rem .9rem; cursor: pointer; background: #fff; font-weight: 500; }
.chips label.on { background: var(--ink); border-color: var(--ink); color: #fff; }
.chips input { position: absolute; opacity: 0; inset: 0; cursor: pointer; }
.chips label:has(input:focus-visible) { outline: 3px solid var(--cobalt); outline-offset: 2px; }
.chips.big label { padding: .7rem 1.3rem; font-size: 1.05rem; }

/* Authentification */
.auth { min-height: 100vh; display: grid; grid-template-columns: 1.15fr 1fr; gap: 4rem; align-items: center; max-width: 1180px; margin: 0 auto; padding: 3rem 2rem; }
.intro { display: grid; gap: 1.4rem; }
.intro h1 { font-size: clamp(2.2rem, 4.6vw, 3.8rem); line-height: 1.02; letter-spacing: -.03em; font-weight: 800; max-width: 14ch; }
.lead { font-size: 1.1rem; color: var(--mute); max-width: 46ch; }
.panel { background: var(--paper); border: 1px solid var(--line); border-radius: 16px; padding: 1.8rem; box-shadow: 0 20px 40px -24px #151c2b55; display: grid; gap: 1.4rem; }
.tabs { display: grid; grid-template-columns: 1fr 1fr; background: var(--fog); border-radius: 10px; padding: 4px; }
.tabs button { border: 0; background: transparent; padding: .6rem; border-radius: 7px; cursor: pointer; font-weight: 600; color: var(--mute); }
.tabs button.on { background: #fff; color: var(--ink); box-shadow: 0 1px 3px #0002; }

/* Aperçu de terminal : la seule animation d'entrée de la page */
.term { background: #1b2233; color: #d8e0f2; border-radius: 12px; overflow: hidden; max-width: 460px; font-family: var(--mono); font-size: .9rem; }
.term-bar { display: flex; gap: 6px; padding: .6rem .8rem; background: #232b40; }
.term-bar i { width: 10px; height: 10px; border-radius: 50%; background: #56607a; }
.term pre { margin: 0; padding: 1rem 1.1rem 1.2rem; line-height: 1.7; font-family: inherit; }
.term b { color: var(--sky); font-weight: 500; }
.l { display: block; opacity: 0; animation: show .01s forwards; }
.l1 { animation-delay: .4s } .l2 { animation-delay: 1.3s } .l3 { animation-delay: 2.3s } .l4 { animation-delay: 3s }
.cursor { display: inline-block; width: .6em; height: 1.05em; background: #d8e0f2; vertical-align: text-bottom; animation: blink 1s steps(2) infinite 3s; }
@keyframes show { to { opacity: 1 } }
@keyframes blink { 50% { opacity: 0 } }

/* Tableau de bord */
.dash { max-width: 1080px; margin: 0 auto; padding: 1.5rem 2rem 3rem; }
.top { display: flex; justify-content: space-between; align-items: center; padding-bottom: 1.5rem; border-bottom: 1px solid var(--line); margin-bottom: 2rem; }
.who { display: flex; align-items: center; gap: 1rem; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; align-items: start; }
.card { background: var(--paper); border: 1px solid var(--line); border-radius: 16px; padding: 1.8rem; display: grid; gap: 1.2rem; }
.card h2 { font-size: 1.5rem; letter-spacing: -.02em; }

/* Ticket de session */
.ticket { background: var(--ink); color: #fff; border-radius: 16px; padding: 1.8rem; display: grid; gap: .8rem; position: relative; }
.ticket .muted { color: #9ba6bd; }
.ticket.off { background: transparent; color: var(--ink); border: 2px dashed var(--line); }
.ticket.off .muted { color: var(--mute); }
.empty-title { font-size: 1.25rem; font-weight: 700; }
.ticket-head { display: flex; align-items: center; gap: .6rem; font-weight: 500; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: #3ddc84; box-shadow: 0 0 0 4px #3ddc8433; }
.clock { font-size: clamp(3.2rem, 7vw, 4.6rem); font-weight: 800; line-height: 1; letter-spacing: -.03em; font-variant-numeric: tabular-nums; color: #fff; }
.urgent .clock { color: #ff6b62; }
.bar { height: 8px; border-radius: 99px; background: #ffffff1f; overflow: hidden; margin-top: .4rem; }
.bar span { display: block; height: 100%; background: var(--sky); transition: width 1s linear; }
.urgent .bar span { background: #ff6b62; }
.perf { border-top: 2px dashed #ffffff33; margin: 1rem -1.8rem .4rem; position: relative; }
.perf::before, .perf::after { content: ''; position: absolute; top: -11px; width: 20px; height: 20px; border-radius: 50%; background: var(--fog); }
.perf::before { left: -10px; } .perf::after { right: -10px; }
.specs { display: grid; grid-template-columns: repeat(3, 1fr); gap: .6rem; margin: 0 0 .4rem; }
.specs > div { background: #ffffff12; border-radius: 10px; padding: .6rem .8rem; }
.specs .wide { grid-column: 1 / -1; }
.specs dt { font-size: .8rem; color: #9ba6bd; }
.specs dd { margin: 0; font-weight: 600; }
.addr { display: flex; justify-content: space-between; align-items: center; gap: 1rem; background: #ffffff12; border-radius: 10px; padding: .6rem .6rem .6rem 1rem; }
.addr code { font-family: var(--mono); font-size: .9rem; overflow-wrap: anywhere; }
.ticket .ghost { border-color: #ffffff40; color: #fff; }
.ticket .ghost:hover { border-color: #fff; }
.actions { display: flex; gap: .8rem; flex-wrap: wrap; margin-top: .4rem; }
.ticket .btn { background: #fff; color: var(--ink); }
.ticket .btn:hover { background: var(--fog); }

.frame { grid-column: 1 / -1; border-radius: 16px; overflow: hidden; border: 1px solid var(--line); background: #1b2233; }
.frame iframe { display: block; width: 100%; height: 520px; border: 0; }

@media (max-width: 860px) {
  .auth { grid-template-columns: 1fr; gap: 2rem; padding: 2rem 1.2rem; }
  .grid { grid-template-columns: 1fr; }
  .dash { padding: 1rem 1.2rem 2rem; }
  .row { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .l { animation: none; opacity: 1; }
  .cursor { animation: none; }
  .bar span { transition: none; }
}
</style>