// ========================================================
// 1. CHAVES DO SUPABASE (Substitua pelos seus dados)
// ========================================================
const SUPABASE_URL = 'https://SEU_PROJETO.supabase.co'
const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANON_AQUI'

let activeImageKeyTarget = null

// Elementos da Tela
const gateScreen = document.getElementById('admin-gate-screen')
const gateForm = document.getElementById('gate-login-form')
const gateFeedback = document.getElementById('gate-feedback')
const gateBtn = document.getElementById('gate-btn')
const adminBar = document.getElementById('admin-bar')

// ========================================================
// 2. FUNÇÕES REST (Sem depender de bibliotecas externas)
// ========================================================

// Login via API REST oficial do Supabase
async function supabaseLogin(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY
    },
    body: JSON.stringify({ email, password })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.msg || data.message || 'Falha ao autenticar')
  return data
}

// Salvar/Editar dados no Banco via REST (Upsert)
async function supabaseUpsert(key, content) {
  const token = localStorage.getItem('va_admin_token')
  const headers = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_ANON_KEY,
    'Prefer': 'resolution=merge-duplicates'
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${SUPABASE_URL}/rest/v1/site_content`, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify([{ key, content, updated_at: new Date().toISOString() }])
  })
  return res.ok
}

// Carregar Conteúdo do Banco
async function loadSiteContent() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/site_content?select=key,content`, {
      headers: { 'apikey': SUPABASE_ANON_KEY }
    })
    if (!res.ok) return
    const data = await res.json()
    if (data && data.length > 0) {
      data.forEach(item => {
        // Textos
        const textElements = document.querySelectorAll(`[data-key="${item.key}"]`)
        textElements.forEach(el => { el.innerText = item.content })

        // Imagens
        const imgElements = document.querySelectorAll(`[data-img-key="${item.key}"]`)
        imgElements.forEach(img => { img.src = item.content })
      })
    }
  } catch (err) {
    console.warn('Modo offline ou sem conexão com banco:', err)
  }
}

// ========================================================
// 3. FLUXO DE LOGIN E PROTEÇÃO
// ========================================================
function checkAuthFlow() {
  const token = localStorage.getItem('va_admin_token')
  const wantsAdmin = window.location.hash === '#admin' || window.location.search.includes('admin=true')

  if (token) {
    // Logado com sucesso
    if (gateScreen) gateScreen.style.display = 'none'
    if (adminBar) adminBar.style.display = 'flex'
    document.body.classList.add('admin-logged')
    enableInlineEditing()
  } else if (wantsAdmin) {
    // Tela de login visível
    if (gateScreen) gateScreen.style.display = 'flex'
    if (adminBar) adminBar.style.display = 'none'
    document.body.classList.remove('admin-logged')
  } else {
    // Visitante comum
    if (gateScreen) gateScreen.style.display = 'none'
    if (adminBar) adminBar.style.display = 'none'
    document.body.classList.remove('admin-logged')
  }
}

// Clique no botão de Login
if (gateForm) {
  gateForm.onsubmit = async function (e) {
    e.preventDefault()

    const email = document.getElementById('gate-email').value.trim()
    const password = document.getElementById('gate-password').value

    if (SUPABASE_URL.includes('SEU_PROJETO') || SUPABASE_ANON_KEY.includes('SUA_CHAVE')) {
      alert('ERRO: Você precisa colar a URL e a ANON KEY do seu Supabase no topo do arquivo script.js!')
      return
    }

    gateBtn.disabled = true
    gateFeedback.textContent = 'Verificando com o servidor...'
    gateFeedback.style.color = '#ff9800'

    try {
      const data = await supabaseLogin(email, password)
      
      // Salva o token de sessão localmente
      localStorage.setItem('va_admin_token', data.access_token)

      gateFeedback.textContent = 'Login autorizado! Entrando...'
      gateFeedback.style.color = '#00e676'

      setTimeout(() => {
        gateScreen.style.display = 'none'
        adminBar.style.display = 'flex'
        document.body.classList.add('admin-logged')
        enableInlineEditing()
        gateBtn.disabled = false
      }, 500)

    } catch (err) {
      gateFeedback.textContent = 'Erro: ' + err.message
      gateFeedback.style.color = '#ff5252'
      gateBtn.disabled = false
    }
  }
}

// ========================================================
// 4. EDIÇÃO DIRETA NO SITE (TEXTOS E FOTOS)
// ========================================================
function enableInlineEditing() {
  // 1. Textos
  const editables = document.querySelectorAll('[data-editable]')
  editables.forEach(el => {
    el.setAttribute('contenteditable', 'true')

    el.onblur = async function () {
      const key = el.getAttribute('data-key')
      const newContent = el.innerText.trim()
      if (!key) return

      const ok = await supabaseUpsert(key, newContent)
      if (ok) {
        el.style.outline = '2px solid #00e676'
        setTimeout(() => { el.style.outline = '1.5px dashed #ff9800' }, 1200)
      } else {
        el.style.outline = '2px solid #ff5252'
      }
    }
  })

  // 2. Fotos
  const imgButtons = document.querySelectorAll('[data-trigger-img]')
  const fileInput = document.getElementById('image-file-input')

  imgButtons.forEach(btn => {
    btn.onclick = function (e) {
      e.stopPropagation()
      activeImageKeyTarget = btn.getAttribute('data-trigger-img')
      if (fileInput) fileInput.click()
    }
  })

  if (fileInput) {
    fileInput.onchange = async function (e) {
      const file = e.target.files[0]
      if (!file || !activeImageKeyTarget) return

      const token = localStorage.getItem('va_admin_token')
      const fileExt = file.name.split('.').pop()
      const fileName = `${activeImageKeyTarget}_${Date.now()}.${fileExt}`
      const triggerBtn = document.querySelector(`[data-trigger-img="${activeImageKeyTarget}"]`)
      
      if (triggerBtn) triggerBtn.innerText = 'Enviando...'

      try {
        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/site-images/uploads/${fileName}`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`
          },
          body: file
        })

        if (!uploadRes.ok) throw new Error('Erro no upload da foto')

        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/site-images/uploads/${fileName}`
        
        await supabaseUpsert(activeImageKeyTarget, publicUrl)

        const targetImg = document.querySelector(`[data-img-key="${activeImageKeyTarget}"]`)
        if (targetImg) targetImg.src = publicUrl

      } catch (err) {
        alert('Erro ao trocar imagem: ' + err.message)
      }

      if (triggerBtn) triggerBtn.innerText = 'Trocar Foto'
      fileInput.value = ''
      activeImageKeyTarget = null
    }
  }
}

// Botão Sair
const logoutBtn = document.getElementById('btn-logout')
if (logoutBtn) {
  logoutBtn.onclick = function () {
    localStorage.removeItem('va_admin_token')
    window.location.hash = ''
    window.location.reload()
  }
}

// Menu Mobile
const menuToggle = document.getElementById('menu-toggle')
const navLinks = document.getElementById('nav-links')
if (menuToggle && navLinks) {
  menuToggle.onclick = function () { navLinks.classList.toggle('active') }
}

window.addEventListener('hashchange', checkAuthFlow)

// Inicia
loadSiteContent()
checkAuthFlow()
