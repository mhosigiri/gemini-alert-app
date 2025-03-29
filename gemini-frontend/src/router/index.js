import { createRouter, createWebHistory } from 'vue-router'
import { auth } from '../firebase'
import Home from '../views/Home.vue'
import Login from '../views/Login.vue'
import Register from '../views/Register.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    meta: { requiresAuth: true }
  },
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/register',
    name: 'Register',
    component: Register
  }
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

// Navigation guards
router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const isAuthenticated = auth.currentUser
  
  console.log('Route navigation:', { to: to.path, requiresAuth, isAuthenticated: !!isAuthenticated })

  if (requiresAuth && !isAuthenticated) {
    console.log('User not authenticated, redirecting to login')
    next('/login')
  } else if (to.path === '/login' && isAuthenticated) {
    console.log('User already logged in, redirecting to home')
    next('/')
  } else {
    next()
  }
})

export default router 