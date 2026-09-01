// ========================================================
// 1. CONFIGURAÇÃO COM AS SUAS CHAVES DO SUPABASE
// ========================================================
const SUPABASE_URL = 'https://hkfhnoxfggjbuhclpyqt.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZmhub3hmZ2dqYnVoY2xweXF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMDkzMTUsImV4cCI6MjEwMzU4NTMxNX0.QivPkzOMTuA2bLi5RFA7bzp2YUwDbOg9xnoQDZ-5fmU'

let activeImageKeyTarget = null
const adminBar = document.getElementById('admin-bar')
const btnSaveAll = document.getElementById('btn-save-all')

// Armazena alterações pendentes em memória antes de clicar em Salvar
const pendingUpdates = new Map()

// ========================================================
// 2. INDICADOR DINÂMICO DE ABERTO / FECHADO (FLORIANÓPOLIS)
// ========================================================
function updateOpenStatusBadge() {
  const badge = document.getElementById('openStatusBadge')
  if (!badge) return

  // Obtém a data/hora local convertida para o fuso de Florianópolis (America/Sao_Paulo)
  const now = new Date()
  const options = { timeZone: 'America/Sao_Paulo', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }
  const formatter = new Intl.DateTimeFormat('pt-BR', options)
  const parts = formatter.formatToParts(now)

  let weekday = ''
  let hour = 0
  let minute = 0

  parts.forEach(p => {
    if (p.type === 'weekday') weekday = p.value.toLowerCase()
    if (p.type === 'hour') hour = parseInt(p.value, 10)
    if (p.type === 'minute') minute = parseInt(p.value, 10)
  })

  // Converte o dia da semana para índice 0 (Dom) a 6 (Sáb)
  const dayIndex = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'narrow' })
  const dayMap = { 'S': 0, 'M': 1, 'T': 2, 'W': 3, 'R': 4, 'F': 5, 'A': 6 } 
  // Alternativa segura usando Intl
  const dayName = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'long' }).format(now)

  let isOpen = false
  let statusMsg = ''

  // Regras de Funcionamento:
  // Segunda: Fechado
  // Terça a Quinta: 18h às 23h
  // Sexta e Sábado: 18h às 00h (24h)
  // Domingo: 18h às 23h
  const currentMinutes = hour * 60 + minute

  if (dayName === 'Monday') {
    isOpen = false
    statusMsg = 'Fechado — abre terça às 18h'
  } else if (dayName === 'Friday' || dayName === 'Saturday') {
    if (currentMinutes >= 18 * 60 && currentMinutes < 24 * 60) {
      isOpen = true
      statusMsg = 'Aberto agora'
    } else {
      isOpen = false
      statusMsg = currentMinutes < 18 * 60 ? 'Fechado — abre às 18h' : 'Fechado — abre amanhã às 18h'
    }
  } else {
    // Terça, Quarta, Quinta e Domingo
    if (currentMinutes >= 18 * 60 && currentMinutes < 23 * 60) {
      isOpen = true
      statusMsg = 'Aberto agora'
    } else {
      isOpen = false
      statusMsg = currentMinutes < 18 * 60 ? 'Fechado — abre às 18h' : (dayName === 'Sunday' ? 'Fechado — abre terça às 18h' : 'Fechado — abre amanhã às 18h')
    }
  }

  const textEl = badge.querySelector('.status-text')
  if (isOpen) {
    badge.className = 'open-status-badge is-open'
    if (textEl) textEl.textContent = statusMsg
  } else {
    badge.className = 'open-status-badge is-closed'
    if (textEl) textEl.textContent = statusMsg
  }
}

// ========================================================
// 3. FUNÇÕES REST DO SUPABASE
// ========================================================
async function loadSiteContent() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/site_content?select=key,content`, {
      headers: { 
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    })
    if (!res.ok) return
    const data = await res.json()
    if (data && data.length > 0) {
      data.forEach(item => {
        // Atualiza Textos
        const textElements = document.querySelectorAll(`[data-key="${item.key}"]:not([data-editable-link])`)
        textElements.forEach(el => { el.innerText = item.content })

        // Atualiza Imagens
        const imgElements = document.querySelectorAll(`[data-img-key="${item.key}"]`)
        imgElements.forEach(img => { img.src = item.content })

        // Atualiza Links
        const linkElements = document.querySelectorAll(`[data-editable-link][data-key="${item.key}"]`)
        linkElements.forEach(link => { link.href = item.content })

        // Atualiza Vídeos
        const videoElements = document.querySelectorAll(`video[data-video-key="${item.key}"]`)
        videoElements.forEach(video => {
          const source = video.querySelector('source')
          if (source) {
            source.src = item.content
            video.load()
          } else {
            video.src = item.content
          }
        })
      })
    }
  } catch (err) {
    console.warn('Erro ao carregar dados do Supabase:', err)
  }
}

async function supabaseBulkUpsert(itemsArray) {
  const token = localStorage.getItem('va_admin_token') || SUPABASE_ANON_KEY
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${token}`,
    'Prefer': 'resolution=merge-duplicates,return=minimal'
  }

  const payload = itemsArray.map(item => ({
    key: item.key,
    content: item.content
  }))

  const res = await fetch(`${SUPABASE_URL}/rest/v1/site_content`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    console.error('Erro detalhado do Supabase:', errData)
    throw new Error(errData.message || errData.details || res.statusText)
  }

  return true
}

async function supabaseUpsertSingle(key, content) {
  return await supabaseBulkUpsert([{ key, content }])
}

// ========================================================
// 4. VERIFICAÇÃO DE SESSÃO DO ADMINISTRADOR
// ========================================================
function checkAuthFlow() {
  const token = localStorage.getItem('va_admin_token')

  if (token) {
    if (adminBar) adminBar.style.display = 'flex'
    document.body.classList.add('admin-logged')
    enableInlineEditing()
  } else {
    if (adminBar) adminBar.style.display = 'none'
    document.body.classList.remove('admin-logged')
  }
}

// ========================================================
// 5. EDIÇÃO DIRETA NO SITE & BOTÃO SALVAR
// ========================================================
function enableInlineEditing() {
  const editables = document.querySelectorAll('[data-editable]')
  editables.forEach(el => {
    el.setAttribute('contenteditable', 'true')

    el.oninput = function () {
      const key = el.getAttribute('data-key')
      const newContent = el.innerText.trim()
      if (!key) return

      pendingUpdates.set(key, newContent)
      el.style.outline = '2px solid #E86328'

      if (btnSaveAll) {
        btnSaveAll.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          <span>Salvar Alterações (${pendingUpdates.size})</span>
        `
        btnSaveAll.style.background = '#00E676'
      }
    }
  })

  if (btnSaveAll) {
    btnSaveAll.onclick = async function () {
      if (pendingUpdates.size === 0) {
        alert('Nenhuma alteração de texto pendente para salvar.')
        return
      }

      btnSaveAll.disabled = true
      btnSaveAll.innerHTML = `<span>Salvando...</span>`

      const batch = []
      pendingUpdates.forEach((content, key) => {
        batch.push({ key, content })
      })

      try {
        await supabaseBulkUpsert(batch)

        pendingUpdates.clear()
        btnSaveAll.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span>Salvo com Sucesso!</span>
        `
        btnSaveAll.style.background = '#00C853'

        editables.forEach(el => {
          el.style.outline = '1.5px dashed #E86328'
        })

        setTimeout(() => {
          btnSaveAll.disabled = false
          btnSaveAll.innerHTML = `
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            <span>Salvar Alterações</span>
          `
        }, 2000)

      } catch (err) {
        alert('Erro ao salvar no banco: ' + err.message)
        btnSaveAll.disabled = false
        btnSaveAll.innerHTML = `<span>Erro ao Salvar</span>`
        btnSaveAll.style.background = '#FF5252'
      }
    }
  }

  const imgButtons = document.querySelectorAll('[data-trigger-img]')
  const fileInput = document.getElementById('image-file-input')

  imgButtons.forEach(btn => {
    btn.onclick = function (e) {
      e.preventDefault()
      e.stopPropagation()
      activeImageKeyTarget = btn.getAttribute('data-trigger-img')
      if (fileInput) fileInput.click()
    }
  })

  if (fileInput) {
    fileInput.onchange = async function (e) {
      const file = e.target.files[0]
      if (!file || !activeImageKeyTarget) return

      const token = localStorage.getItem('va_admin_token') || SUPABASE_ANON_KEY
      const fileExt = file.name.split('.').pop()
      const fileName = `${activeImageKeyTarget}_${Date.now()}.${fileExt}`
      const filePath = `uploads/${fileName}`
      const triggerBtn = document.querySelector(`[data-trigger-img="${activeImageKeyTarget}"]`)
      
      if (triggerBtn) triggerBtn.innerText = 'Enviando...'

      try {
        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/site-images/${filePath}`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`
          },
          body: file
        })

        if (!uploadRes.ok) throw new Error('Erro ao salvar imagem no Storage')

        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/site-images/${filePath}`
        await supabaseUpsertSingle(activeImageKeyTarget, publicUrl)

        const targetImgs = document.querySelectorAll(`[data-img-key="${activeImageKeyTarget}"]`)
        targetImgs.forEach(img => { img.src = publicUrl })

      } catch (err) {
        alert('Erro ao trocar imagem: ' + err.message)
      }

      if (triggerBtn) {
        triggerBtn.innerText = activeImageKeyTarget === 'site_logo_img' ? 'Trocar Logo' : 'Trocar Foto'
      }
      fileInput.value = ''
      activeImageKeyTarget = null
    }
  }

  const editableLinks = document.querySelectorAll('[data-editable-link]')
  editableLinks.forEach(link => {
    link.onclick = async function(e) {
      if (document.body.classList.contains('admin-logged')) {
        e.preventDefault()
        const key = link.getAttribute('data-key')
        const currentUrl = link.getAttribute('href')
        const newUrl = prompt(`Editar destino do link (${key}):`, currentUrl)

        if (newUrl && newUrl.trim() !== '' && newUrl !== currentUrl) {
          link.setAttribute('href', newUrl.trim())
          try {
            await supabaseUpsertSingle(key, newUrl.trim())
            alert('Link atualizado com sucesso!')
          } catch (err) {
            alert('Erro ao salvar link no banco: ' + err.message)
          }
        }
      }
    }
  })
}

// ========================================================
// 6. MOTOR DE ANIMAÇÃO SCROLL REVEAL
// ========================================================
function initAnimations() {
  const animatedElements = document.querySelectorAll(
    '.hero-content, .hero-spotlight, .menu-item-card, .mosaic-item, .unit-location-card, .review-card, .pillar-box, .contact-split, .sensory-item'
  )

  animatedElements.forEach((el, index) => {
    el.classList.add('reveal-item')
    const delayClass = `reveal-delay-${(index % 4) + 1}`
    el.classList.add(delayClass)
  })

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-revealed')
        observer.unobserve(entry.target)
      }
    })
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  })

  document.querySelectorAll('.reveal-item').forEach(el => observer.observe(el))
}

// Botão Sair (Logout)
const logoutBtn = document.getElementById('btn-logout')
if (logoutBtn) {
  logoutBtn.onclick = function () {
    localStorage.removeItem('va_admin_token')
    window.location.href = 'login.html'
  }
}

// Menu Mobile
const menuToggle = document.getElementById('menu-toggle')
const navLinks = document.getElementById('nav-links')
if (menuToggle && navLinks) {
  menuToggle.onclick = function () { navLinks.classList.toggle('active') }
}

// Speed Dial Mobile Toggle
const hubTrigger = document.getElementById('hubTrigger')
const floatingHub = document.getElementById('floatingHub')
if (hubTrigger && floatingHub) {
  hubTrigger.onclick = function(e) {
    if (window.innerWidth <= 768) {
      // No mobile, se clicar no container expande as opções
      floatingHub.classList.toggle('active')
    }
  }
  document.addEventListener('click', function(e) {
    if (!floatingHub.contains(e.target)) {
      floatingHub.classList.remove('active')
    }
  })
}

// Formulário de Contato Direto para WhatsApp
const contactForm = document.getElementById('contact-form')
if (contactForm) {
  contactForm.addEventListener('submit', function(e) {
    e.preventDefault()
    const nome = document.getElementById('nome').value
    const msg = document.getElementById('mensagem').value
    const zapText = encodeURIComponent(`Olá! Meu nome é ${nome}. Mensagem do site: ${msg}`)
    window.open(`https://wa.me/5548998388277?text=${zapText}`, '_blank')
  })
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  updateOpenStatusBadge()
  setInterval(updateOpenStatusBadge, 60000) // Atualiza a cada 1 minuto
  initAnimations()
  loadSiteContent()
  checkAuthFlow()
})
