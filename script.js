import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'YOUR_SUPABASE_URL'
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 1. Fetch content from Supabase and populate the website on load
async function loadSiteContent() {
    try {
        const { data, error } = await supabase.from('site_content').select('*')
        if (error) {
            console.error('Error loading content:', error)
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
        console.error('Unexpected error loading content:', err)
    }
}

// 2. Check if the user is authenticated as Admin
async function checkAuthSession() {
    const { data: { session } } = await supabase.auth.getSession()
    
    const adminBar = document.getElementById('admin-bar')
    const loginSection = document.getElementById('admin-login-section')

    if (session) {
        if (adminBar) adminBar.style.display = 'flex'
        if (loginSection) loginSection.style.display = 'none' // Esconde o formulário se já estiver logado
        enableInlineEditing()
    } else {
        if (adminBar) adminBar.style.display = 'none'
        if (loginSection) loginSection.style.display = 'block'
    }
}

// 3. Enable inline editing features when logged in
function enableInlineEditing() {
    const editables = document.querySelectorAll('[data-editable]')

    editables.forEach(el => {
        el.contentEditable = true
        el.style.borderBottom = '2px dashed #ff9800'
        el.style.cursor = 'text'
        el.title = 'Click to edit this content'

        el.addEventListener('blur', async () => {
            const key = el.getAttribute('data-key')
            const newContent = el.textContent.trim()

            const { error } = await supabase
                .from('site_content')
                .upsert({ key: key, content: newContent }, { onConflict: 'key' })

            if (error) {
                console.error('Error saving update:', error)
                alert('Failed to save changes.')
            } else {
                console.log(`Successfully saved: ${key}`)
            }
        })
    })
}

// 4. Admin Login Form Submission
const loginForm = document.getElementById('admin-login-form')

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault()
        
        const emailInput = document.getElementById('login-email').value
        const passwordInput = document.getElementById('login-password').value
        const feedback = document.getElementById('login-feedback')

        feedback.textContent = 'Logging in...'
        feedback.style.color = '#ff9800'

        const { error } = await supabase.auth.signInWithPassword({
            email: emailInput,
            password: passwordInput
        })

        if (error) {
            feedback.textContent = 'Login failed: ' + error.message
            feedback.style.color = '#ff6b6b'
        } else {
            feedback.textContent = 'Login successful! Updating page...'
            feedback.style.color = '#4cd137'
            setTimeout(() => {
                window.location.reload()
            }, 1000)
        }
    })
}

// 5. Logout Control
const logoutBtn = document.getElementById('btn-logout')

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut()
        window.location.reload()
    })
}

// Initialize on page load
loadSiteContent()
checkAuthSession()
