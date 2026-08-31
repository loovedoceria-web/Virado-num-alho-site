import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

// Substitua com suas credenciais do Supabase
const SUPABASE_URL = 'SUA_SUPABASE_URL'
const SUPABASE_ANON_KEY = 'SUA_SUPABASE_ANON_KEY'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let activeImageKeyTarget = null

// 1. Carrega dados do Supabase
async function loadSiteContent() {
  try {
    const { data, error } = await supabase.from('site_content').select('key, content')
    if (error) {
      console.error('Erro ao carregar dados:', error)
      return
    }

    if (data && data.length > 0) {
      data.forEach(item => {
        // Textos
        const textElements = document.querySelectorAll(`[data-key="${item.key}"]`)
        textElements.forEach(el => {
          el.innerText = item.content
        })

        // Imagens
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

// 2. Verifica se o usuário autenticado veio da página login.html
async function checkAuthSession() {
  const { data: { session } } = await supabase.auth.getSession()
  const adminBar = document.getElementById('admin-bar')

  if (session) {
    document.body.classList.add('admin-logged')
    if (adminBar) adminBar.style.display = 'flex'
    enableTextInlineEditing()
    enableImageUploadEditing()
  } else {
    document.body.classList.remove('admin-logged')
    if (adminBar) adminBar.style.display = 'none'
  }
}

// 3. Ativa edição em tempo real de textos
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

// 4. Ativa troca de fotos via Supabase Storage
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

    const { error: uploadError } = await supabase.storage
      .from('site-images')
      .upload(filePath, file, { cacheControl: '3600', upsert: true })

    if (uploadError) {
      alert('Erro ao enviar imagem: ' + uploadError.message)
      if (originalBtn) originalBtn.innerText = 'Trocar Foto'
      return
    }

    const { data: publicUrlData } = supabase.storage
      .from('site-images')
      .getPublicUrl(filePath)

    const publicUrl = publicUrlData.publicUrl

    const { error: dbError } = await supabase
      .from('site_content')
      .upsert(
        { key: activeImageKeyTarget, content: publicUrl, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      )

    if (dbError) {
      alert('Erro ao salvar endereço da imagem: ' + dbError.message)
    } else {
      const imgTarget = document.querySelector(`[data-img-key="${activeImageKeyTarget}"]`)
      if (imgTarget) imgTarget.src = publicUrl
    }

    if (originalBtn) originalBtn.innerText = 'Trocar Foto'
    fileInput.value = ''
    activeImageKeyTarget = null
  }
}

// 5. Botão de Logout
const logoutBtn = document.getElementById('btn-logout')
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut()
    window.location.href = 'login.html'
  })
}

// 6. Botão para ocultar contornos de edição
const previewBtn = document.getElementById('btn-preview')
if (previewBtn) {
  previewBtn.addEventListener('click', () => {
    document.body.classList.toggle('admin-logged')
    previewBtn.innerText = document.body.classList.contains('admin-logged')
      ? 'Ocultar Marcações'
      : 'Mostrar Marcações'
  })
}

// 7. Menu Mobile
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
