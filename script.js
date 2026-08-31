import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'SUA_SUPABASE_URL'
const SUPABASE_ANON_KEY = 'SUA_SUPABASE_ANON_KEY'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 1. Carrega o conteúdo do Supabase para o site
async function loadSiteContent() {
    try {
        const { data, error } = await supabase.from('site_content').select('*')
        if (error) {
            console.error('Erro ao carregar conteúdo:', error)
            return
        }

        if (data) {
            data.forEach(item => {
                const element = document.querySelector(`[data-key="${item.key}"]`)
                if (element) {
                    element.textContent = item.content
                }
            })
        }
    } catch (err) {
        console.error('Erro inesperado:', err)
    }
}

// 2. Verifica a sessão e gerencia a interface do Admin
async function checkAuthSession() {
    const { data: { session } } = await supabase.auth.getSession()
    
    const adminBar = document.getElementById('admin-bar')
    const loginSection = document.getElementById('admin-login-section')

    if (session) {
        if (adminBar) adminBar.style.display = 'flex'
        if (loginSection) loginSection.style.display = 'none'
        
        // Ativa a edição imediatamente e garante que os elementos respondam
        setTimeout(enableInlineEditing, 200)
    } else {
        if (adminBar) adminBar.style.display = 'none'
        if (loginSection) loginSection.style.display = 'block'
    }
}

// 3. Ativa a edição direto na tela e salva ao perder o foco (blur)
function enableInlineEditing() {
    const editables = document.querySelectorAll('[data-editable]')

    editables.forEach(el => {
        el.setAttribute('contenteditable', 'true')
        el.style.borderBottom = '2px dashed #ff9800'
        el.style.cursor = 'text'

        el.addEventListener('blur', async () => {
            const key = el.getAttribute('data-key')
            const newContent = el.textContent.trim()

            const { error } = await supabase
                .from('site_content')
                .upsert({ key: key, content: newContent }, { onConflict: 'key' })

            if (error) {
                console.error('Erro ao salvar:', error)
                alert('Erro ao salvar alteração.')
            } else {
                console.log(`Salvo com sucesso: ${key}`)
            }
        })
    })
}

// 4. Formulário de Login
const loginForm = document.getElementById('admin-login-form')

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        
        const emailInput = document.getElementById('login-email').value
        const passwordInput = document.getElementById('login-password').value
        const feedback = document.getElementById('login-feedback')

        feedback.textContent = 'Entrando...'
        feedback.style.color = '#ff9800'

        const { error } = await supabase.auth.signInWithPassword({
            email: emailInput,
            password: passwordInput
        })

        if (error) {
            feedback.textContent = 'Erro ao entrar: ' + error.message
            feedback.style.color = '#ff6b6b'
        } else {
            feedback.textContent = 'Login com sucesso! Carregando painel...'
            feedback.style.color = '#4cd137'
            setTimeout(() => {
                window.location.reload()
            }, 800)
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

// Inicialização
loadSiteContent()
checkAuthSession()
