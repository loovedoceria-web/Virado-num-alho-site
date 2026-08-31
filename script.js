import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Substitua pelas suas chaves do Supabase
const SUPABASE_URL = 'SUA_SUPABASE_URL'
const SUPABASE_ANON_KEY = 'SUA_SUPABASE_ANON_KEY'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let activeImageKeyTarget = null

// 1. Carrega todos os textos e fotos salvos no Supabase
async function loadSiteContent() {
  try {
    const { data, error } = await supabase.from('site_content').select('key, content')
    if (error) {
      console.error('Erro ao buscar dados:', error)
      return
    }

    if (data && data.length > 0) {
      data.forEach(item => {
        // Aplica Textos
        const textElements = document.querySelectorAll(`[data-key="${item.key}"]`)
        textElements.forEach(el => {
          el.innerText = item.content
        })

        // Aplica Imagens
        const imgElements = document.querySelectorAll(`[data-img-key="${item.key}"]`)
        imgElements.forEach(img => {
          img.src = item.content
        })
      })
    }
  } catch (err) {
    console.error('Erro geral ao carregar dados:', err)
  }
}

// 2. Gerenciamento de Login e Sessão
async function checkAuthSession() {
  const { data: { session } } = await supabase.auth.getSession()
  const adminBar = document.getElementById('admin-bar')
  const loginModal = document.getElementById('admin-login-modal')

  if (session) {
    document.body.classList.add('admin-logged')
    if (adminBar) adminBar.style.display = 'flex'
    if (loginModal) loginModal.style.display = 'none'
    enableTextInlineEditing()
    enableImageUploadEditing()
  } else {
    document.body.classList.remove('admin-logged')
    if (adminBar) adminBar.style.display = 'none'

    // Abre o modal de login apenas se o usuário acessar via #admin ou /login
    if (window.location.hash === '#admin' || window.location.pathname.endsWith('/login')) {
      if (loginModal) loginModal.style.display = 'flex'
    }
  }
}

// 3. Edição Direta de Textos (Salva ao desfocar / onBlur)
function enableTextInlineEditing() {
  const editables = document.querySelectorAll('[data-editable]')

  editables.forEach(el => {
    el.setAttribute('contenteditable', 'true')

    el.addEventListener('blur', async () => {
      const key = el.getAttribute('data-key')
      const newContent = el.innerText.trim()

      if (!key) return

      const { error } = await supabase
        .from('site_content')
        .upsert(
          { key: key, content: newContent, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )

      if (error) {
        console.error(`Erro ao salvar [${key}]:`, error)
        el.style.outline = '2px solid #ff4d4d'
      } else {
        el.style.outline = '2px solid #00e676'
        setTimeout(() => {
          el.style.outline = '1.5px dashed #ff9800'
        }, 1200)
      }
    })
  })
}

// 4. Edição e Troca de Imagens com Upload no Supabase Storage
function enableImageUploadEditing() {
  const imgButtons = document.querySelectorAll('[data-trigger-img]')
  const fileInput = document.getElementById('image-file-input')

  imgButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      activeImageKeyTarget = btn.getAttribute('data-trigger-img')
      fileInput.click()
    })
  })

  fileInput.onchange = async (e) => {
    const file = e.target.files[0]
    if (!file || !activeImageKeyTarget) return

    const fileExt = file.name.split('.').pop()
    const fileName = `${activeImageKeyTarget}_${Date.now()}.${fileExt}`
    const filePath = `uploads/${fileName}`

    const originalBtn = document.querySelector(`[data-trigger-img="${activeImageKeyTarget}"]`)
    if (originalBtn) originalBtn.innerText = 'Enviando...'

    // Upload da imagem no bucket site-images
    const { error: uploadError } = await supabase.storage
      .from('site-images')
      .upload(filePath, file, { cacheControl: '3600', upsert: true })

    if (uploadError) {
      alert('Erro no envio da imagem: ' + uploadError.message)
      if (originalBtn) originalBtn.innerText = 'Trocar Foto'
      return
    }

    // Pega a URL pública gerada
    const { data: publicUrlData } = supabase.storage
      .from('site-images')
      .getPublicUrl(filePath)

    const publicUrl = publicUrlData.publicUrl

    // Salva a nova URL na tabela de conteúdo
    const { error: dbError } = await supabase
      .from('site_content')
      .upsert(
        { key: activeImageKeyTarget, content: publicUrl, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )

    if (dbError) {
      alert('Erro ao salvar nova URL no banco: ' + dbError.message)
    } else {
      const imgTarget = document.querySelector(`[data-img-key="${activeImageKeyTarget}"]`)
      if (imgTarget) imgTarget.src = publicUrl
    }

    if (originalBtn) originalBtn.innerText = 'Trocar Foto'
    fileInput.value = ''
    activeImageKeyTarget = null
  }
}

// 5. Formulário de Login do Modal
const loginForm = document.getElementById('admin-login-form')
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()

    const email = document.getElementById('login-email').value.trim()
    const password = document.getElementById('login-password').value
    const feedback = document.getElementById('login-feedback')

    feedback.textContent = 'Verificando credenciais...'
    feedback.style.color = '#ff9800'

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      feedback.textContent = 'Falha: ' + error.message
      feedback.style.color = '#ff4d4d'
    } else {
      feedback.textContent = 'Acesso liberado! Entrando no modo edição...'
      feedback.style.color = '#00e676'
      setTimeout(() => {
        window.location.hash = ''
        window.location.reload()
      }, 700)
    }
  })
}

// 6. Botão de Fechar Modal
const closeBtn = document.getElementById('btn-close-modal')
if (closeBtn) {
  closeBtn.addEventListener('click', () => {
    document.getElementById('admin-login-modal').style.display = 'none'
    window.location.hash = ''
  })
}

// 7. Botão de Logout
const logoutBtn = document.getElementById('btn-logout')
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut()
    window.location.reload()
  })
}

// 8. Botão para alternar visualização (com ou sem contornos de edição)
const previewBtn = document.getElementById('btn-preview')
if (previewBtn) {
  previewBtn.addEventListener('click', () => {
    document.body.classList.toggle('admin-logged')
    previewBtn.innerText = document.body.classList.contains('admin-logged')
      ? 'Ocultar Contornos'
      : 'Mostrar Contornos'
  })
}

// 9. Menu Mobile
const menuToggle = document.getElementById('menu-toggle')
const navLinks = document.getElementById('nav-links')
if (menuToggle && navLinks) {
  menuToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active')
  })
}

// Monitora alterações na URL para abrir o modal caso digite `#admin`
window.addEventListener('hashchange', () => {
  if (window.location.hash === '#admin') {
    document.getElementById('admin-login-modal').style.display = 'flex'
  }
})

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await loadSiteContent()
  await checkAuthSession()
})
