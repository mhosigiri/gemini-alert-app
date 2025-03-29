<template>
  <div class="login-container">
    <h1>Login</h1>
    <div v-if="error" class="error-message">{{ error }}</div>
    
    <form @submit.prevent="login">
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" v-model="email" required>
      </div>
      
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" v-model="password" required>
      </div>
      
      <div class="buttons">
        <button type="submit" :disabled="loading">{{ loading ? 'Logging in...' : 'Login' }}</button>
        <router-link to="/register" class="register-link">Need an account? Register</router-link>
      </div>
    </form>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../firebase'
import { signInWithEmailAndPassword } from 'firebase/auth'

export default {
  name: 'LoginPage',
  
  setup() {
    const email = ref('')
    const password = ref('')
    const error = ref(null)
    const loading = ref(false)
    const router = useRouter()
    
    const login = async () => {
      loading.value = true
      error.value = null
      
      try {
        await signInWithEmailAndPassword(auth, email.value, password.value)
        router.push('/')
      } catch (err) {
        console.error(err)
        error.value = 'Invalid email or password'
      } finally {
        loading.value = false
      }
    }
    
    return {
      email,
      password,
      error,
      loading,
      login
    }
  }
}
</script>

<style scoped>
.login-container {
  max-width: 400px;
  margin: 40px auto;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

h1 {
  margin-top: 0;
  color: #4CAF50;
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

.error-message {
  color: #f44336;
  margin-bottom: 15px;
  padding: 10px;
  background-color: #ffebee;
  border-radius: 4px;
}

.buttons {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.register-link {
  margin-top: 15px;
  color: #4CAF50;
  text-decoration: none;
}

.register-link:hover {
  text-decoration: underline;
}
</style> 