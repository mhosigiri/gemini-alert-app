<template>
  <div class="register-container">
    <h1>Create an Account</h1>
    <div v-if="error" class="error-message">{{ error }}</div>
    <div v-if="successMessage" class="success-message">{{ successMessage }}</div>
    <form @submit.prevent="register">
      <div class="form-group">
        <label for="name">Full Name</label>
        <input type="text" id="name" v-model="name" required>
      </div>
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" v-model="email" required>
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" v-model="password" required min="6">
        <small>Password must be at least 6 characters long</small>
      </div>
      <div class="buttons">
        <button type="submit" :disabled="isLoading">
          {{ isLoading ? 'Creating Account...' : 'Register' }}
        </button>
      </div>
    </form>
    <p class="auth-link">
      Already have an account? <router-link to="/login">Login here</router-link>
    </p>
  </div>
</template>
<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../firebase'
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth'
import { ensureUserInDatabase } from '../services/userService'
export default {
  name: 'RegisterPage',
  setup() {
    const name = ref('')
    const email = ref('')
    const password = ref('')
    const error = ref(null)
    const successMessage = ref(null)
    const loading = ref(false)
    const router = useRouter()
    const register = async () => {
      loading.value = true
      error.value = null
      successMessage.value = null
      if (password.value.length < 6) {
        error.value = 'Password must be at least 6 characters'
        loading.value = false
        return
      }
      try {
        // Create user with email and password
        const userCredential = await createUserWithEmailAndPassword(auth, email.value, password.value)
        const user = userCredential.user
        // Update profile with name
        await updateProfile(user, {
          displayName: name.value
        })
        // Ensure user is added to both Firestore and RTDB
        try {
          await ensureUserInDatabase(user)
        } catch (dbErr) {
        }
        router.push('/')
      } catch (err) {
        if (err.code === 'auth/email-already-in-use') {
          error.value = 'Email already in use'
        } else {
          error.value = 'Failed to create account: ' + (err.message || 'Unknown error')
        }
      } finally {
        loading.value = false
      }
    }
    return {
      name,
      email,
      password,
      error,
      successMessage,
      loading,
      register
    }
  }
}
</script>
<style scoped>
.register-container {
  max-width: 400px;
  margin: 40px auto;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}
h1 {
  margin-top: 0;
  color: #4285F4;
}
.form-group {
  margin-bottom: 15px;
  text-align: left;
}
label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}
small {
  display: block;
  color: #666;
  margin-top: 5px;
}
.error-message {
  color: #f44336;
  margin-bottom: 15px;
  padding: 10px;
  background-color: #ffebee;
  border-radius: 4px;
}
.success-message {
  color: #4CAF50;
  margin-bottom: 15px;
  padding: 10px;
  background-color: #e8f5e9;
  border-radius: 4px;
}
input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}
button {
  width: 100%;
  padding: 12px;
  background-color: #4285F4;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  transition: background-color 0.3s;
}
button:hover:not(:disabled) {
  background-color: #3367d6;
}
button:disabled {
  background-color: #9bb8ea;
  cursor: not-allowed;
}
.buttons {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.login-link {
  margin-top: 15px;
  color: #4285F4;
  text-decoration: none;
}
.login-link:hover {
  text-decoration: underline;
}
.demo-account {
  margin-top: 25px;
  padding-top: 15px;
  border-top: 1px solid #eee;
  text-align: center;
}
.test-account-btn {
  background-color: #34A853;
}
.test-account-btn:hover:not(:disabled) {
  background-color: #2e8f49;
}
</style> 