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
    const openLoginBtn = document.getElementById('btn-open-login')

    if (session) {
        if (adminBar) adminBar.style.display = 'flex'
        if (openLoginBtn) openLoginBtn.style.display = 'none'
        enableInlineEditing()
    } else {
        if (adminBar) adminBar.style.display = 'none'
        if (openLoginBtn) openLoginBtn.style.display = 'block'
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

        // Save automatically when clicking outside the element (blur event)
        el.addEventListener('blur', async () => {
            const key = el.getAttribute('data-key')
            const newContent = el.textContent.trim()

            // Upsert handles both insert or update safely if the key exists
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

// 4. Modal and Authentication Controls
const loginModal = document.getElementById('login-modal')
const openLoginBtn = document.getElementById('btn-open-login')
const closeLoginBtn = document.getElementById('btn-close-login')
const submitLoginBtn = document.getElementById('btn-submit-login')
const logoutBtn = document.getElementById('btn-logout')

if (openLoginBtn) {
    openLoginBtn.addEventListener('click', () => {
        loginModal.style.display = 'flex'
    })
}

if (closeLoginBtn) {
    closeLoginBtn.addEventListener('click', () => {
        loginModal.style.display = 'none'
    })
}

if (submitLoginBtn) {
    submitLoginBtn.addEventListener('click', async () => {
        const emailInput = document.getElementById('admin-email').value
        const passwordInput = document.getElementById('admin-password').value

        const { error } = await supabase.auth.signInWithPassword({
            email: emailInput,
            password: passwordInput
        })

        if (error) {
            alert('Login failed: ' + error.message)
        } else {
            alert('Login successful!')
            window.location.reload()
        }
    })
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut()
        window.location.reload()
    })
}

// Initialize on page load
loadSiteContent()
checkAuthSession()
