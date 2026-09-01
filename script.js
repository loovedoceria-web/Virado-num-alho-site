// ========================================================
// 1. CONFIGURAÇÃO DO SUPABASE (Substitua com suas chaves)
// ========================================================
const SUPABASE_URL = 'SUA_SUPABASE_URL'
const SUPABASE_ANON_KEY = 'SUA_SUPABASE_ANON_KEY'

// Inicialização segura
let supabase = null
try {
  if (window.supabase) {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  } else {
    console.error('Supabase CDN não foi carregado corretamente.')
  }
} catch (e) {
  console.error('Erro ao iniciar Supabase:', e)
}

let activeImageKeyTarget = null

// Elementos da Interface
const gateScreen = document.getElementById('admin-gate-screen')
const gateForm = document.getElementById('gate-login-form')
const gateFeedback = document.getElementById('gate-feedback')
const gateBtn = document.getElementById('gate-btn')
const adminBar = document.getElementById('admin-bar')

// ========================================================
// 2. CARREGAR CONTEÚDO SALVO
// ========================================================
async function loadSiteContent() {
  if (!supabase) return
  try {
    const { data, error } = await supabase.from('site_content').select('key, content')
    if (error) {
      console.warn('Aviso ao buscar dados do site:', error.message)
      return
    }

    if (data && data.length > 0) {
      data.forEach(item => {
        // Atualiza Textos
        const textElements = document.querySelectorAll(`[data-key="${item.key}"]`)
        textElements.forEach(el => { el.innerText = item.content })

        // Atualiza Imagens
        const imgElements = document.querySelectorAll(`[data-img-key="${item.key}"]`)
        imgElements.forEach(img => { img.src = item.content })
      })
    }
  } catch (err) {
    console.error('Erro geral ao carregar dados:', err)
  }
}

// ========================================================
// 3. FLUXO DE LOGIN E VERIFICAÇÃO DE SESSÃO
// ========================================================
async function checkAuthFlow() {
  if (!supabase) return

  try {
    const { data: { session } } = await supabase.auth.getSession()
    const wantsAdmin = window.location.hash === '#admin' || window.location.search.includes('admin=true')

    if (session) {
      // Já autenticado
      if (gateScreen) gateScreen.style.display = 'none'
      if (adminBar) adminBar.style.display = 'flex'
      document.body.classList.add('admin-logged')
      enableInlineEditing()
    } else if (wantsAdmin) {
      // Não autenticado mas quer acessar admin
      if (gateScreen) gateScreen.style.display = 'flex'
      if (adminBar) adminBar.style.display = 'none'
      document.body.classList.remove('admin-logged')
    } else {
      // Visitante comum
      if (gateScreen) gateScreen.style.display = 'none'
      if (adminBar) adminBar.style.display = 'none'
      document.body.classList.remove('admin-logged')
    }
  } catch (err) {
    console.error('Erro na checagem de sessão:', err)
  }
}

// Evento de envio do formulário de login
if (gateForm) {
  gateForm.addEventListener('submit', async function(e) {
    e.preventDefault()

    const emailInput = document.getElementById('gate-email')
    const passInput = document.getElementById('gate-password')

    const email = emailInput ? emailInput.value.trim() : ''
    const password = passInput ? passInput.value : ''

    if (!supabase) {
      alert('Erro: A biblioteca do Supabase não carregou. Verifique a conexão com a internet.')
      return
    }

    if (SUPABASE_URL.includes('SUA_SUPABASE_URL')) {
      alert('Você esqueceu de colar a URL e ANON KEY do Supabase no topo do script.js!')
      return
    }

    if (gateBtn) gateBtn.disabled = true
    if (gateFeedback) {
      gateFeedback.textContent = 'Autenticando com o servidor...'
      gateFeedback.style.color = '#ff9800'
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })

      if (error) {
        console.error('Erro do Supabase:', error)
        if (gateFeedback) {
          gateFeedback.textContent = 'Erro: ' + error.message
          gateFeedback.style.color = '#ff5252'
        }
        if (gateBtn) gateBtn.disabled = false
      } else {
        if (gateFeedback) {
          gateFeedback.textContent = 'Login com sucesso! Entrando...'
          gateFeedback.style.color = '#00e676'
        }

        setTimeout(() => {
          if (gateScreen) gateScreen.style.display = 'none'
          if (adminBar) adminBar.style.display = 'flex'
          document.body.classList.add('admin-logged')
          enableInlineEditing()
          if (gateBtn) gateBtn.disabled = false
        }, 500)
      }
    } catch (err) {
      console.error('Erro fatal no login:', err)
      if (gateFeedback) {
        gateFeedback.textContent = 'Erro inesperado: ' + err.message
        gateFeedback.style.color = '#ff5252'
      }
      if (gateBtn) gateBtn.disabled = false
    }
  })
}

// ========================================================
// 4. FERRAMENTAS DE EDIÇÃO (TEXTOS E FOTOS)
// ========================================================
function enableInlineEditing() {
  // 1. Textos
  const editables = document.querySelectorAll('[data-editable]')
  editables.forEach(el => {
    el.setAttribute('contenteditable', 'true')

    el.onblur = async function() {
      const key = el.getAttribute('data-key')
      const newContent = el.innerText.trim()
      if (!key || !supabase) return

      const { error } = await supabase
        .from('site_content')
        .upsert({ key: key, content: newContent, updated_at: new Date().toISOString() }, { onConflict: 'key' })

      if (error) {
        console.error(`Erro ao salvar [${key}]:`, error)
        el.style.outline = '2px solid #ff5252'
      } else {
        el.style.outline = '2px solid #00e676'
        setTimeout(() => { el.style.outline = '1.5px dashed #ff9800' }, 1200)
      }
    }
  })

  // 2. Fotos
  const imgButtons = document.querySelectorAll('[data-trigger-img]')
  const fileInput = document.getElementById('image-file-input')

  imgButtons.forEach(btn => {
    btn.onclick = function(e) {
      e.stopPropagation()
      activeImageKeyTarget = btn.getAttribute('data-trigger-img')
      if (fileInput) fileInput.click()
    }
  })

  if (fileInput) {
    fileInput.onchange = async function(e) {
      const file = e.target.files[0]
      if (!file || !activeImageKeyTarget || !supabase) return

      const fileExt = file.name.split('.').pop()
      const fileName = `${activeImageKeyTarget}_${Date.now()}.${fileExt}`
      const filePath = `uploads/${fileName}`

      const triggerBtn = document.querySelector(`[data-trigger-img="${activeImageKeyTarget}"]`)
      if (triggerBtn) triggerBtn.innerText = 'Enviando...'

      const { error: uploadError } = await supabase.storage
        .from('site-images')
        .upload(filePath, file, { cacheControl: '3600', upsert: true })

      if (uploadError) {
        alert('Erro no upload: ' + uploadError.message)
        if (triggerBtn) triggerBtn.innerText = 'Trocar Foto'
        return
      }

      const { data: publicUrlData } = supabase.storage.from('site-images').getPublicUrl(filePath)
      const publicUrl = publicUrlData.publicUrl

      await supabase.from('site_content').upsert(
        { key: activeImageKeyTarget, content: publicUrl, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )

      const targetImg = document.querySelector(`[data-img-key="${activeImageKeyTarget}"]`)
      if (targetImg) targetImg.src = publicUrl

      if (triggerBtn) triggerBtn.innerText = 'Trocar Foto'
      fileInput.value = ''
      activeImageKeyTarget = null
    }
  }
}

// Botão de Logout
const logoutBtn = document.getElementById('btn-logout')
if (logoutBtn) {
  logoutBtn.onclick = async function() {
    if (supabase) await supabase.auth.signOut()
    window.location.hash = ''
    window.location.reload()
  }
}

// Menu Mobile
const menuToggle = document.getElementById('menu-toggle')
const navLinks = document.getElementById('nav-links')
if (menuToggle && navLinks) {
  menuToggle.onclick = function() { navLinks.classList.toggle('active') }
}

// Monitora hash na URL (#admin)
window.addEventListener('hashchange', checkAuthFlow)

// Inicialização imediata
loadSiteContent()
checkAuthFlow()
