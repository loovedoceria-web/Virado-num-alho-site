import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// ==========================================
// 1. CONFIGURAÇÃO DO SUPABASE
// Substitua com as credenciais do seu projeto
// ==========================================
const SUPABASE_URL = 'SUA_SUPABASE_URL'
const SUPABASE_ANON_KEY = 'SUA_SUPABASE_ANON_KEY'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let activeImageKeyTarget = null

// Atalho: se acessar index.html#admin, redireciona para login.html
if (window.location.hash === '#admin') {
  window.location.href = 'login.html'
}

// ==========================================
// 2. CARREGAR CONTEÚDO DO SUPABASE (Textos e Fotos)
// ==========================================
async function loadSiteContent() {
  try {
    const { data, error } = await supabase.from('site_content').select('key, content')
    
    if (error) {
      console.error('Erro ao buscar dados do Supabase:', error)
      return
    }

    if (data && data.length > 0) {
      data.forEach(item => {
        // Atualiza textos
        const textElements = document.querySelectorAll(`[data-key="${item.key}"]`)
        textElements.forEach(el => {
          el.innerText = item.content
        })

        // Atualiza imagens
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

// ==========================================
// 3. VERIFICAÇÃO DE SESSÃO DO ADMINISTRADOR
// ==========================================
async function checkAuthSession() {
  const { data: { session } } = await supabase.auth.getSession()
  const adminBar = document.getElementById('admin-bar')

  if (session) {
    // Adiciona classe no body que ativa os estilos visuais de edição
    document.body.classList.add('admin-logged')
    if (adminBar) adminBar.style.display = 'flex'
    
    enableTextInlineEditing()
    enableImageUploadEditing()
  } else {
    document.body.classList.remove('admin-logged')
    if (adminBar) adminBar.style.display = 'none'
  }
}

// ==========================================
// 4. EDIÇÃO INLINE DE TEXTOS (Salva no Blur)
// ==========================================
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
        // Feedback visual verde de confirmação
        el.style.outline = '2px solid #00e676'
        setTimeout(() => {
          el.style.outline = '1.5px dashed #ff9800'
        }, 1200)
      }
    })
  })
}

// ==========================================
// 5. TROCA DE FOTOS COM UPLOAD NO STORAGE
// ==========================================
function enableImageUploadEditing() {
  const imgButtons = document.querySelectorAll('[data-trigger-img]')
  const fileInput = document.getElementById('image-file-input')

  if (!fileInput) return

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

    // Upload no bucket "site-images"
    const { error: uploadError } = await supabase.storage
      .from('site-images')
      .upload(filePath, file, { cacheControl: '3600', upsert: true })

    if (uploadError) {
      alert('Erro ao enviar imagem: ' + uploadError.message)
      if (originalBtn) originalBtn.innerText = 'Trocar Foto'
      return
    }

    // Obter URL pública
    const { data: publicUrlData } = supabase.storage
      .from('site-images')
      .getPublicUrl(filePath)

    const publicUrl = publicUrlData.publicUrl

    // Grava a URL no banco de dados
    const { error: dbError } = await supabase
      .from('site_content')
      .upsert(
        { key: activeImageKeyTarget, content: publicUrl, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )

    if (dbError) {
      alert('Erro ao salvar URL no banco: ' + dbError.message)
    } else {
      const imgTarget = document.querySelector(`[data-img-key="${activeImageKeyTarget}"]`)
      if (imgTarget) imgTarget.src = publicUrl
    }

    if (originalBtn) originalBtn.innerText = 'Trocar Foto'
    fileInput.value = ''
    activeImageKeyTarget = null
  }
}

// ==========================================
// 6. EVENTOS DE INTERFACE E ADMINISTRAÇÃO
// ==========================================

// Botão de Logout -> Encerra a sessão e volta para o login
const logoutBtn = document.getElementById('btn-logout')
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut()
    window.location.href = 'login.html'
  })
}

// Botão para pré-visualizar (ocultar/exibir bordas de edição)
const previewBtn = document.getElementById('btn-preview')
if (previewBtn) {
  previewBtn.addEventListener('click', () => {
    document.body.classList.toggle('admin-logged')
    previewBtn.innerText = document.body.classList.contains('admin-logged')
      ? 'Ocultar Marcações'
      : 'Mostrar Marcações'
  })
}

// Menu Mobile
const menuToggle = document.getElementById('menu-toggle')
const navLinks = document.getElementById('nav-links')
if (menuToggle && navLinks) {
  menuToggle.addEventListener('click', () => {
    navLinks.classList.toggle('active')
  })
}

// ==========================================
// 7. INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  await loadSiteContent()
  await checkAuthSession()
})
