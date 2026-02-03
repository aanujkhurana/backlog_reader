import { createRouter, createWebHistory } from 'vue-router'
import LandingView from '../views/LandingView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: LandingView,
    },
    {
      path: '/setup/:documentId',
      name: 'setup',
      component: () => import('../views/SetupView.vue'),
    },
    {
      path: '/reading/:documentId',
      name: 'reading',
      component: () => import('../views/ReadingView.vue'),
    },
    {
      path: '/summary/:documentId',
      name: 'summary',
      component: () => import('../views/SummaryView.vue'),
    },
    {
      path: '/completion/:documentId',
      name: 'completion',
      component: () => import('../views/CompletionView.vue'),
    },
    {
      path: '/about',
      name: 'about',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: () => import('../views/AboutView.vue'),
    },
  ],
})

export default router
