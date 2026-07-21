import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue')
  },
  {
    path: '/',
    name: 'passport',
    component: () => import('@/views/PassportView.vue')
  },
  {
    path: '/create',
    name: 'create',
    component: () => import('@/views/CreatePassport.vue')
  },
  {
    path: '/fuel',
    name: 'fuel',
    component: () => import('@/views/AddFuel.vue')
  },
  {
    path: '/qr',
    name: 'qr',
    component: () => import('@/views/QRShare.vue')
  },
  {
    path: '/plan',
    name: 'plan',
    component: () => import('@/views/ServicePlan.vue')
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('@/views/HistoryTree.vue')
  },
  {
    path: '/task',
    name: 'task',
    component: () => import('@/views/AddTask.vue')
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/AdminFeedback.vue')
  }
]

export const router = createRouter({
  history: createWebHistory(),
  routes
})
