<template>
  <div class="auth-page">
    <div class="auth-card">
      <h1>Gemini Alert</h1>
      <p class="auth-sub">Create your account</p>
      <div v-if="error" class="msg-bad">{{ error }}</div>
      <div v-if="successMessage" class="msg-good">{{ successMessage }}</div>
      <form @submit.prevent="register">
        <div class="field">
          <label for="first-name">First Name</label>
          <input type="text" id="first-name" v-model="firstName" required placeholder="Jane">
        </div>
        <div class="field">
          <label for="last-name">Last Name</label>
          <input type="text" id="last-name" v-model="lastName" required placeholder="Doe">
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input type="email" id="email" v-model="email" required placeholder="you@email.com">
        </div>
        <div class="field">
          <label for="password">Password</label>
          <input type="password" id="password" v-model="password" required minlength="6" placeholder="6+ characters">
        </div>
        <button type="submit" :disabled="isLoading" class="btn-primary">
          {{ isLoading ? 'Creating...' : 'Create Account' }}
        </button>
      </form>
      <p class="auth-link">
        Have an account? <router-link to="/login">Sign in</router-link>
      </p>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../firebase'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { ensureUserInDatabase } from '../services/userService'
export default {
  name: 'RegisterPage',
  setup() {
    const firstName = ref('')
    const lastName = ref('')
    const email = ref('')
    const password = ref('')
    const error = ref(null)
    const successMessage = ref(null)
    const isLoading = ref(false)
    const router = useRouter()
    const register = async () => {
      isLoading.value = true; error.value = null; successMessage.value = null
      if (password.value.length < 6) { error.value = 'Password must be at least 6 characters'; isLoading.value = false; return }
      try {
        const userCredential = await createUserWithEmailAndPassword(auth, email.value, password.value)
        const user = userCredential.user
        const displayName = `${firstName.value} ${lastName.value}`.trim()
        await updateProfile(user, { displayName })
        try { await ensureUserInDatabase(user, { firstName: firstName.value, lastName: lastName.value, password: password.value }) } catch (dbErr) { /* silent */ }
        router.push('/')
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') error.value = 'Email already in use'
        else error.value = 'Failed to create account: ' + (err.message || 'Unknown error')
      } finally { isLoading.value = false }
    }
    return { firstName, lastName, email, password, error, successMessage, isLoading, register }
  }
}
</script>

<style scoped>
.auth-page { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: var(--sp-md); }
.auth-card { width: 100%; max-width: 380px; text-align: center; }
h1 { font-size: var(--fs-xl); font-weight: 800; letter-spacing: -0.03em; margin-bottom: 0; }
.auth-sub { color: var(--c-text-soft); font-size: var(--fs-sm); margin-bottom: var(--sp-lg); }
.msg-bad { color: var(--c-bad); padding: var(--sp-sm) var(--sp-md); border-radius: var(--radius-pill); font-size: var(--fs-sm); margin-bottom: var(--sp-md); border: 1px solid var(--c-bad); }
.msg-good { color: var(--c-good); padding: var(--sp-sm) var(--sp-md); border-radius: var(--radius-pill); font-size: var(--fs-sm); margin-bottom: var(--sp-md); border: 1px solid var(--c-good); }
.field { margin-bottom: var(--sp-md); text-align: left; }
.field label { display: block; margin-bottom: var(--sp-xs); font-size: var(--fs-sm); font-weight: 600; color: var(--c-text-soft); }
.field input { width: 100%; padding: 0.65rem 1rem; border: 1px solid var(--c-border); border-radius: var(--radius-pill); font-size: var(--fs-base); background: var(--c-bg); color: var(--c-text); outline: none; transition: border-color 0.15s; }
.field input:focus { border-color: var(--c-text); }
.field input::placeholder { color: var(--c-text-soft); }
.btn-primary { width: 100%; padding: 0.7rem; border: none; border-radius: var(--radius-pill); background: var(--c-text); color: var(--c-bg); font-size: var(--fs-base); font-weight: 700; transition: opacity 0.15s; margin-top: var(--sp-sm); }
.btn-primary:hover:not(:disabled) { opacity: 0.8; }
.btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
.auth-link { margin-top: var(--sp-lg); font-size: var(--fs-sm); color: var(--c-text-soft); }
.auth-link a { color: var(--c-text); font-weight: 600; text-decoration: none; }
.auth-link a:hover { text-decoration: underline; }
</style>
