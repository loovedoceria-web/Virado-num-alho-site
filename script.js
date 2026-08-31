import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Substitua pelas credenciais do seu projeto Supabase
const SUPABASE_URL = 'SUA_SUPABASE_URL'
const SUPABASE_ANON_KEY = 'SUA_SUPABASE_ANON_KEY'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 1. Carrega o conteúdo do Supabase para a página
async function loadSiteContent() {
  try {
    const { data, error } = await supabase.from('site_content').select('key, content')
    
    if (error) {
      console.error('Erro ao carregar conteúdo do Supabase:', error)
      return
    }

    if (data && data.length > 0) {
      data.forEach(item => {
        const elements = document.querySelectorAll(`[data-key="${item.key}"]`)
        elements.forEach(element => {
          element.innerText = item.content
        })
      })
    }
  } catch (err) {
    console.error('Erro inesperado ao carregar dados:', err)
  }
}

// 2. Verifica a sessão de autenticação do Admin
async function checkAuthSession() {
  const { data: { session } } = await supabase.auth.getSession()
  
  const adminBar = document.getElementById('admin-bar')
  const loginSection = document.getElementById('admin-login-section')

  if (session) {
    if (adminBar) adminBar.style.display = 'flex'
    if (loginSection) loginSection.style.display = 'none'
    enableInlineEditing()
  } else {
    if (adminBar) adminBar.style.display = 'none'
    if (loginSection) loginSection.style.display = 'block'
  }
}

// 3. Ativa edição inline nos elementos marcados com [data-editable]
function enableInlineEditing() {
  const editables = document.querySelectorAll('[data-editable]')

  editables.forEach(el => {
    el.setAttribute('contenteditable', 'true')
    el.style.borderBottom = '2px dashed #ff9800'
    el.style.cursor = 'text'

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
        el.style.borderBottom = '2px dashed #ff6b6b'
      } else {
        el.style.borderBottom = '2px dashed #4cd137'
        setTimeout(() => {
          el.style.borderBottom = '2px dashed #ff9800'
        }, 1500)
      }
    })
  })
}

// 4. Formulário de Login do Administrador
const loginForm = document.getElementById('admin-login-form')
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault()

    const email = document.getElementById('login-email').value.trim()
    const password = document.getElementById('login-password').value
    const feedback = document.getElementById('login-feedback')

    feedback.textContent = 'Autenticando...'
    feedback.style.color = '#ff9800'

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      feedback.textContent = `Erro: ${error.message}`
      feedback.style.color = '#ff6b6b'
    } else {
      feedback.textContent = 'Sucesso! Carregando modo de edição...'
      feedback.style.color = '#4cd137'
      setTimeout(() => window.location.reload(), 600)
    }
  })
}

// 5. Botão de Logout
const logoutBtn = document.getElementById('btn-logout')
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut()
    window.location.reload()
  })
}

// 6. Menu Mobile (Hamburguer)
const menuToggle = document.getElementById('menu-toggle')
const navLinks = document.getElementById('nav-links')
if (menuToggle && navLinks) {
  menuToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active')
  })
}

// Inicialização
document.addEventListener('DOMContentLoaded', async () => {
  await loadSiteContent()
  await checkAuthSession()
})
