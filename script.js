// ========================================================
// 1. CONFIGURAÇÃO COM SUAS CHAVES DO SUPABASE
// ========================================================
const SUPABASE_URL = 'https://hkfhnoxfggjbuhclpyqt.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrZmhub3hmZ2dqYnVoY2xweXF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwMDkzMTUsImV4cCI6MjEwMzU4NTMxNX0.QivPkzOMTuA2bLi5RFA7bzp2YUwDbOg9xnoQDZ-5fmU'

let activeImageKeyTarget = null
const adminBar = document.getElementById('admin-bar')

// ========================================================
// 2. FUNÇÕES REST (Sem dependências externas)
// ========================================================

// Carrega textos, imagens e links salvos no Supabase
async function loadSiteContent() {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/site_content?select=key,content`, {
      headers: { 'apikey': SUPABASE_ANON_KEY }
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

        // Atualiza Links (WhatsApp, iFood, etc.)
        const linkElements = document.querySelectorAll(`[data-editable-link][data-key="${item.key}"]`)
        linkElements.forEach(link => { link.href = item.content })
      })
    }
  } catch (err) {
    console.warn('Erro ao carregar conteúdo do Supabase:', err)
  }
}

// Salva alterações no Banco de Dados
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

// ========================================================
// 3. VERIFICAÇÃO DE SESSÃO DO ADMINISTRADOR
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
// 4. EDIÇÃO DIRETA NO SITE (TEXTOS, FOTOS E LINKS)
// ========================================================
function enableInlineEditing() {
  // 1. Edição de Textos
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

  // 2. Edição de Imagens
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

        if (!uploadRes.ok) throw new Error('Erro ao salvar no Storage')

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

  // 3. Edição de Links (WhatsApp, iFood, etc.)
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
          const ok = await supabaseUpsert(key, newUrl.trim())
          if (ok) {
            alert('Link atualizado com sucesso!')
          } else {
            alert('Erro ao salvar link no banco.')
          }
        }
      }
    }
  })
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

// Inicialização
loadSiteContent()
checkAuthFlow()
