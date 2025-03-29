<template>
  <div class="register-container">
    <h1>Create an Account</h1>
    <div v-if="error" class="error-message">{{ error }}</div>
    
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
        <button type="submit" :disabled="loading">{{ loading ? 'Creating Account...' : 'Register' }}</button>
        <router-link to="/login" class="login-link">Already have an account? Login</router-link>
      </div>
    </form>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth, db } from '../firebase'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { setDoc, doc } from 'firebase/firestore'

export default {
  name: 'RegisterPage',
  
  setup() {
    const name = ref('')
    const email = ref('')
    const password = ref('')
    const error = ref(null)
    const loading = ref(false)
    const router = useRouter()
    
    const register = async () => {
      loading.value = true
      error.value = null
      
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
        
        // Store user data in Firestore
        await setDoc(doc(db, 'users', user.uid), {
          name: name.value,
          email: email.value,
          createdAt: new Date()
        })
        
        router.push('/')
      } catch (err) {
        console.error(err)
        if (err.code === 'auth/email-already-in-use') {
          error.value = 'Email already in use'
        } else {
          error.value = 'Failed to create account. Please try again.'
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

.buttons {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.login-link {
  margin-top: 15px;
  color: #4CAF50;
  text-decoration: none;
}

.login-link:hover {
  text-decoration: underline;
}
</style> 