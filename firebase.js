import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyB5JqSrNI2fX8uaCxrsWhwCkEFFSjgtRgM',
  authDomain: 'kanban-3ca38.firebaseapp.com',
  projectId: 'kanban-3ca38',
  storageBucket: 'kanban-3ca38.firebasestorage.app',
  messagingSenderId: '467468722923',
  appId: '1:467468722923:web:8e3f88206d5dc17ca9d4ae',
  measurementId: 'G-38F3MMJ1BN'
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const aiApiBaseUrl = (
  document.querySelector('meta[name="kanban-api-url"]')?.content.trim()
  || window.location.origin
).replace(/\/+$/, '');
