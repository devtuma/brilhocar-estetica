/* ============================================================
   FIREBASE-SERVICE.JS — BrilhoCar Estética Automotiva
   Abstração de banco de dados usando Firebase Firestore
   ============================================================ */

const FirebaseService = (() => {
    let _db = null;          // Firestore
    let _auth = null;        // Authentication
    let _storage = null;     // Storage
    let _mode = 'local';     // 'firebase' | 'local'
    let _ready = false;
    let _lastError = '';

    /* ---- Helpers localStorage (fallback) ---- */
    const LS = {
        settings: 'bc_settings',
        services: 'bc_services',
        clients: 'bc_clients',
        appointments: 'bc_appointments',
        transactions: 'bc_transactions',
        images: 'bc_images',
        audit_logs: 'bc_audit_logs',
        testimonials: 'bc_testimonials',
    };

    const lsGet = k => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
    const lsSet = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    const lsDel = (k, id) => lsSet(k, lsGet(k).filter(x => x.id !== id));
    const uid = () =>
        (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
              });

    /* ================================================================
       INICIALIZAÇÃO
       ================================================================ */
    async function init() {
        const cfg = window.FIREBASE_CONFIG || {};

        if (!cfg.apiKey || cfg.apiKey === 'SUA_API_KEY') {
            _lastError = 'FIREBASE_CONFIG não configurado em js/firebase-config.js';
            console.warn('[Firebase]', _lastError);
        } else if (!window.firebase) {
            _lastError = 'Firebase SDK não carregou (verifique conexão com internet)';
            console.warn('[Firebase]', _lastError);
        } else {
            try {
                // Inicializa Firebase
                const app = window.firebase.initializeApp(cfg);
                _db = window.firebase.firestore();
                _auth = window.firebase.auth();
                _storage = window.firebase.storage();

                // Testa conexão com Firestore (settings é mais confiável que services)
                try {
                    await _db.collection('settings').doc('business').get();
                } catch (e1) {
                    // Se falhar, tenta outra collection
                    try {
                        await _db.collection('appointments').limit(1).get();
                    } catch (e2) {
                        // Se falhar tudo, tenta só inicializar (sem testar)
                        console.warn('[Firebase] Não foi possível testar conexão, usando modo firebase mesmo assim');
                    }
                }

                _mode = 'firebase';
                _ready = true;
                _lastError = '';
                console.info('[Firebase] Firebase conectado ✅', cfg.projectId);
                return 'firebase';
            } catch (e) {
                _lastError = e.message;
                console.warn('[Firebase] Exceção ao conectar:', e.message);
            }
        }

        _mode = 'local';
        _ready = true;
        console.info('[Firebase] Modo localStorage (fallback) 📦');
        return 'local';
    }

    const lastError = () => _lastError;
    const mode = () => _mode;
    const isFirebase = () => _mode === 'firebase';

    /* ================================================================
       CRUD GENÉRICO — Firestore
       ================================================================ */

    // GET ALL
    async function get(collection) {
        if (_mode === 'firebase') {
            try {
                // Tenta com orderBy primeiro (pode falhar se não houver índice)
                let snapshot;
                try {
                    snapshot = await _db.collection(collection).orderBy('createdAt', 'desc').get();
                } catch (e1) {
                    // Fallback: sem orderBy
                    snapshot = await _db.collection(collection).get();
                }
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                return data;
            } catch (e) {
                console.warn(`[Firebase] get('${collection}') erro:`, e.message);
                return lsGet(LS[collection] || collection);
            }
        }
        return lsGet(LS[collection] || collection);
    }

    // GET BY ID
    async function getById(collection, id) {
        if (_mode === 'firebase') {
            try {
                const doc = await _db.collection(collection).doc(id).get();
                if (doc.exists) return { id: doc.id, ...doc.data() };
                return null;
            } catch (e) {
                console.warn(`[Firebase] getById erro:`, e.message);
                return null;
            }
        }
        return lsGet(LS[collection]).find(x => x.id === id) || null;
    }

    // INSERT
    async function insert(collection, obj) {
        const now = (_mode === 'firebase' && window.firebase?.firestore?.FieldValue)
            ? window.firebase.firestore.FieldValue.serverTimestamp()
            : new Date().toISOString();
        const row = { ...obj, id: obj.id || uid(), createdAt: now };

        if (_mode === 'firebase') {
            try {
                const docRef = await _db.collection(collection).add(row);
                const doc = await docRef.get();
                return { id: doc.id, ...doc.data() };
            } catch (e) {
                console.warn(`[Firebase] insert('${collection}') erro:`, e.message);
                const arr = lsGet(LS[collection]);
                arr.unshift({ ...row, createdAt: new Date().toISOString() });
                lsSet(LS[collection], arr);
                return row;
            }
        }
        const arr = lsGet(LS[collection]);
        arr.unshift({ ...row, createdAt: new Date().toISOString() });
        lsSet(LS[collection], arr);
        return row;
    }

    // UPDATE
    async function update(collection, id, obj) {
        const now = (_mode === 'firebase' && window.firebase?.firestore?.FieldValue)
            ? window.firebase.firestore.FieldValue.serverTimestamp()
            : new Date().toISOString();
        if (_mode === 'firebase') {
            try {
                const docRef = _db.collection(collection).doc(id);
                await docRef.update({
                    ...obj,
                    updatedAt: now
                });
                const doc = await docRef.get();
                return { id: doc.id, ...doc.data() };
            } catch (e) {
                console.warn(`[Firebase] update('${collection}') erro:`, e.message);
                const arr = lsGet(LS[collection]);
                const idx = arr.findIndex(x => x.id === id);
                if (idx >= 0) arr[idx] = { ...arr[idx], ...obj };
                lsSet(LS[collection], arr);
                return arr[idx] || null;
            }
        }
        const arr = lsGet(LS[collection]);
        const idx = arr.findIndex(x => x.id === id);
        if (idx >= 0) arr[idx] = { ...arr[idx], ...obj };
        lsSet(LS[collection], arr);
        return arr[idx] || null;
    }

    // DELETE
    async function del(collection, id) {
        if (_mode === 'firebase') {
            try {
                await _db.collection(collection).doc(id).delete();
            } catch (e) {
                console.warn(`[Firebase] del('${collection}') erro:`, e.message);
            }
        }
        lsDel(LS[collection], id);
        return true;
    }

    /* ================================================================
       SETTINGS (especial - documento único)
       ================================================================ */
    async function getSetting(key) {
        if (_mode === 'firebase') {
            try {
                const doc = await _db.collection('settings').doc('business').get();
                if (doc.exists) {
                    const data = doc.data();
                    return data[key] ?? null;
                }
            } catch (e) {
                console.warn('[Firebase] getSetting erro:', e.message);
            }
        }
        const all = JSON.parse(localStorage.getItem(LS.settings) || '{}');
        return all[key] ?? null;
    }

    async function getAllSettings() {
        if (_mode === 'firebase') {
            try {
                const doc = await _db.collection('settings').doc('business').get();
                if (doc.exists) return doc.data();
            } catch (e) {
                console.warn('[Firebase] getAllSettings erro:', e.message);
            }
        }
        return JSON.parse(localStorage.getItem(LS.settings) || '{}');
    }

    async function setSetting(key, value) {
        const now = (_mode === 'firebase' && window.firebase?.firestore?.FieldValue)
            ? window.firebase.firestore.FieldValue.serverTimestamp()
            : new Date().toISOString();
        if (_mode === 'firebase') {
            try {
                await _db.collection('settings').doc('business').set({
                    [key]: value,
                    updatedAt: now
                }, { merge: true });
                return true;
            } catch (e) {
                console.warn('[Firebase] setSetting erro:', e.message);
            }
        }
        const all = JSON.parse(localStorage.getItem(LS.settings) || '{}');
        all[key] = value;
        localStorage.setItem(LS.settings, JSON.stringify(all));
        return true;
    }

    async function setAllSettings(obj) {
        const now = (_mode === 'firebase' && window.firebase?.firestore?.FieldValue)
            ? window.firebase.firestore.FieldValue.serverTimestamp()
            : new Date().toISOString();
        if (_mode === 'firebase') {
            try {
                await _db.collection('settings').doc('business').set({
                    ...obj,
                    updatedAt: now
                }, { merge: true });
                return true;
            } catch (e) {
                console.warn('[Firebase] setAllSettings erro:', e.message);
            }
        }
        localStorage.setItem(LS.settings, JSON.stringify(obj));
        return true;
    }

    /* ================================================================
       UPLOAD DE IMAGENS — Firebase Storage
       ================================================================ */
    async function uploadImage(file, path) {
        if (_mode === 'firebase' && _storage) {
            try {
                const ref = _storage.ref(path);
                const snapshot = await ref.put(file);
                const url = await snapshot.ref.getDownloadURL();
                return url;
            } catch (e) {
                console.warn('[Firebase] uploadImage erro:', e.message);
            }
        }
        // Fallback: base64
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /* ================================================================
       AUTENTICAÇÃO — Firebase Auth
       ================================================================ */
    async function signIn(email, password) {
        if (!_auth) throw new Error('Firebase Auth não inicializado');
        return _auth.signInWithEmailAndPassword(email, password);
    }

    async function signOut() {
        if (!_auth) return;
        return _auth.signOut();
    }

    async function getUser() {
        if (!_auth) return null;
        return _auth.currentUser;
    }

    function onAuthStateChanged(callback) {
        if (!_auth) return () => {};
        return _auth.onAuthStateChanged(callback);
    }

    async function createUser(email, password) {
        if (!_auth) throw new Error('Firebase Auth não inicializado');
        return _auth.createUserWithEmailAndPassword(email, password);
    }

    /* ================================================================
       REALTIME — Firestore listeners
       ================================================================ */
    function subscribe(collection, callback) {
        if (_mode !== 'firebase') return () => {};
        return _db.collection(collection)
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                callback(data);
            });
    }

    /* ================================================================
       UTILITÁRIOS
       ================================================================ */
    function generateOSNumber() {
        const year = new Date().getFullYear();
        const random = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
        return `BC-${year}-${random}`;
    }

    function generateQRData(appointmentId, osNumber, plate) {
        return JSON.stringify({
            appointmentId,
            osNumber,
            plate
        });
    }

    /* ================================================================
       EXPORT
       ================================================================ */
    return {
        init,
        mode,
        isFirebase,
        lastError,
        get,
        getById,
        insert,
        update,
        del,
        getSetting,
        getAllSettings,
        setSetting,
        setAllSettings,
        uploadImage,
        signIn,
        signOut,
        getUser,
        onAuthStateChanged,
        createUser,
        subscribe,
        uid,
        generateOSNumber,
        generateQRData,
    };
})();

// Apelido curto para uso nos arquivos
const FB = FirebaseService;
